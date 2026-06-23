const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const {
    isAntiSpamEnabled,
    setAntiSpamEnabled,
    messageLimit,
    timeWindow,
    timeoutDuration
} = require("../utils/antiSpam")
const { getLogChannel } = require("../utils/logSettings")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("antispam")
        .setDescription("Configure automatic spam protection")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("enable")
                .setDescription("Enable automatic spam protection")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription("Disable automatic spam protection")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("status")
                .setDescription("View the anti-spam status")
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    "You need Manage Server permission to configure anti-spam.",
                flags: MessageFlags.Ephemeral
            })
        }

        const subcommand = interaction.options.getSubcommand()
        const currentlyEnabled = isAntiSpamEnabled(interaction.guild.id)

        if (subcommand === "enable") {
            if (currentlyEnabled) {
                return interaction.reply({
                    content: "Anti-spam is already enabled.",
                    flags: MessageFlags.Ephemeral
                })
            }

            setAntiSpamEnabled(
                interaction.guild.id,
                true,
                interaction.user.id
            )
        }

        if (subcommand === "disable") {
            if (!currentlyEnabled) {
                return interaction.reply({
                    content: "Anti-spam is already disabled.",
                    flags: MessageFlags.Ephemeral
                })
            }

            setAntiSpamEnabled(
                interaction.guild.id,
                false,
                interaction.user.id
            )
        }

        const enabled =
            subcommand === "enable"
                ? true
                : subcommand === "disable"
                  ? false
                  : currentlyEnabled
        const embed = new EmbedBuilder()
            .setColor(enabled ? "#57f287" : "#ed4245")
            .setTitle(
                enabled
                    ? "Anti-Spam Enabled"
                    : "Anti-Spam Disabled"
            )
            .setDescription(
                enabled
                    ? `Triggers at **${messageLimit} messages in ${
                          timeWindow / 1_000
                      } seconds**. Regular members receive a **${
                          timeoutDuration / 60_000
                      }-minute timeout**. Staff are logged but not punished.`
                    : "Automatic spam detection is turned off."
            )
            .setFooter({
                text:
                    subcommand === "status"
                        ? "Current server setting"
                        : `Updated by ${interaction.user.tag}`
            })
            .setTimestamp()

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })

        if (subcommand === "status") return

        const logChannel = getLogChannel(interaction.guild)
        if (!logChannel) return

        const logEmbed = new EmbedBuilder()
            .setColor(enabled ? "#57f287" : "#ed4245")
            .setTitle(
                enabled
                    ? "Anti-Spam Enabled"
                    : "Anti-Spam Disabled"
            )
            .addFields(
                {
                    name: "Changed by",
                    value: `${interaction.user}\n\`${interaction.user.id}\``,
                    inline: true
                },
                {
                    name: "Status",
                    value: enabled ? "Enabled" : "Disabled",
                    inline: true
                }
            )
            .setTimestamp()

        if (enabled) {
            logEmbed.addFields({
                name: "Protection",
                value:
                    `${messageLimit} messages in ` +
                    `${timeWindow / 1_000} seconds • ` +
                    `${timeoutDuration / 60_000}-minute timeout`
            })
        }

        await logChannel
            .send({ embeds: [logEmbed] })
            .catch(console.error)
    }
}
