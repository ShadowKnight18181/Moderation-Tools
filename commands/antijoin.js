const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const {
    enableAntiJoin,
    disableAntiJoin,
    getAntiJoinSettings,
    parseDuration
} = require("../utils/antiJoin")
const { getLogChannel } = require("../utils/logSettings")

function actionLabel(action) {
    return action === "ban" ? "Temporary ban (24 hours)" : "Kick"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antijoin")
        .setDescription("Manage emergency anti-join protection")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("enable")
                .setDescription("Temporarily block new members from joining")
                .addStringOption(option =>
                    option
                        .setName("duration")
                        .setDescription(
                            "How long to enable it, such as 30m, 2h, or 24h"
                        )
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("action")
                        .setDescription("Action to apply to new members")
                        .addChoices(
                            { name: "Kick", value: "kick" },
                            {
                                name: "Temporary ban (24 hours)",
                                value: "ban"
                            }
                        )
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription("Disable anti-join protection")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription("View the anti-join status")
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    "You need Manage Server permission to configure anti-join.",
                flags: MessageFlags.Ephemeral
            })
        }

        const subcommand = interaction.options.getSubcommand()
        const current = getAntiJoinSettings(interaction.guild.id)

        if (subcommand === "enable") {
            const durationName =
                interaction.options.getString("duration")
            const duration = parseDuration(durationName)
            const action =
                interaction.options.getString("action") || "kick"

            if (!duration) {
                return interaction.reply({
                    content:
                        "Use a duration such as `30m`, `2h`, or `24h`. Maximum: 24 hours.",
                    flags: MessageFlags.Ephemeral
                })
            }

            const botMember = interaction.guild.members.me
            const requiredPermission =
                action === "ban"
                    ? PermissionFlagsBits.BanMembers
                    : PermissionFlagsBits.KickMembers

            if (!botMember?.permissions.has(requiredPermission)) {
                return interaction.reply({
                    content:
                        `I need the ${
                            action === "ban" ? "Ban Members" : "Kick Members"
                        } permission for that action.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            const settings = enableAntiJoin(
                interaction.client,
                interaction.guild.id,
                {
                    duration,
                    durationName,
                    action,
                    enabledBy: interaction.user.id
                }
            )
            const expiryTimestamp = Math.floor(
                new Date(settings.expiresAt).getTime() / 1000
            )

            await interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#ed4245")
                        .setTitle("Anti-Join Enabled")
                        .setDescription(
                            "New human members will be blocked until " +
                                `<t:${expiryTimestamp}:F> ` +
                                `(<t:${expiryTimestamp}:R>).`
                        )
                        .addFields({
                            name: "Action",
                            value: actionLabel(action)
                        })
                        .setFooter({
                            text: `Enabled by ${interaction.user.tag}`
                        })
                        .setTimestamp()
                ],
                flags: MessageFlags.Ephemeral
            })

            const logChannel = getLogChannel(interaction.guild)
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor("#ed4245")
                    .setTitle("Anti-Join Enabled")
                    .addFields(
                        {
                            name: "Enabled by",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Action",
                            value: actionLabel(action),
                            inline: true
                        },
                        {
                            name: "Expires",
                            value: `<t:${expiryTimestamp}:F>\n<t:${expiryTimestamp}:R>`
                        }
                    )
                    .setTimestamp()

                await logChannel
                    .send({ embeds: [embed] })
                    .catch(console.error)
            }
            return
        }

        if (subcommand === "disable") {
            if (!current) {
                return interaction.reply({
                    content: "Anti-join is already disabled.",
                    flags: MessageFlags.Ephemeral
                })
            }

            disableAntiJoin(
                interaction.guild.id,
                interaction.user.id
            )

            await interaction.reply({
                content: "Anti-join protection has been disabled.",
                flags: MessageFlags.Ephemeral
            })

            const logChannel = getLogChannel(interaction.guild)
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor("#57f287")
                    .setTitle("Anti-Join Disabled")
                    .addFields({
                        name: "Disabled by",
                        value: `${interaction.user}`
                    })
                    .setTimestamp()

                await logChannel
                    .send({ embeds: [embed] })
                    .catch(console.error)
            }
            return
        }

        if (!current) {
            return interaction.reply({
                content: "Anti-join protection is currently disabled.",
                flags: MessageFlags.Ephemeral
            })
        }

        const expiryTimestamp = Math.floor(
            new Date(current.expiresAt).getTime() / 1000
        )
        await interaction.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor("#fee75c")
                    .setTitle("Anti-Join Status")
                    .addFields(
                        {
                            name: "Status",
                            value: "Enabled",
                            inline: true
                        },
                        {
                            name: "Action",
                            value: actionLabel(current.action),
                            inline: true
                        },
                        {
                            name: "Expires",
                            value: `<t:${expiryTimestamp}:F>\n<t:${expiryTimestamp}:R>`
                        },
                        {
                            name: "Enabled by",
                            value: `<@${current.enabledBy}>`
                        }
                    )
                    .setTimestamp()
            ],
            flags: MessageFlags.Ephemeral
        })
    }
}
