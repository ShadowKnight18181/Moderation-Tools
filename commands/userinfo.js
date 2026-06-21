const fs = require("fs")
const path = require("path")

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { getUserCases } = require("../utils/modCases")

const warningsPath = path.join(__dirname, "../data/warnings.json")

function getWarningCount(guildId, memberId) {
    try {
        const warnings = JSON.parse(fs.readFileSync(warningsPath, "utf8"))
        return warnings[guildId]?.[memberId]?.length || 0
    } catch {
        return 0
    }
}

function formatModerationCases(cases) {
    if (cases.length === 0) {
        return "No moderation cases recorded by this bot."
    }

    return cases.slice(0, 6).map(modCase => {
        const timestamp = Math.floor(
            new Date(modCase.createdAt).getTime() / 1000
        )
        const reason =
            modCase.reason.length > 90
                ? `${modCase.reason.slice(0, 87)}...`
                : modCase.reason

        return (
            `**${modCase.type}** \`${modCase.id}\` • <t:${timestamp}:R>\n` +
            `${reason} — <@${modCase.moderatorId}>`
        )
    }).join("\n\n")
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("userinfo")
        .setDescription("View information about a server member")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Type the member's display name")
                .setRequired(true)
        ),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const isModerator = interaction.memberPermissions.has(
            PermissionFlagsBits.ModerateMembers
        )

        if (!isOwner && !isModerator) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators can use `/userinfo`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("member")

        if (!member) {
            return interaction.reply({
                content: "That member could not be found in this server.",
                flags: MessageFlags.Ephemeral
            })
        }

        const accountCreated = Math.floor(
            member.user.createdTimestamp / 1000
        )
        const joinedServer = member.joinedTimestamp
            ? Math.floor(member.joinedTimestamp / 1000)
            : null
        const warningCount = getWarningCount(
            interaction.guild.id,
            member.id
        )
        const moderationCases = getUserCases(
            interaction.guild.id,
            member.id
        )
        const roles = member.roles.cache
            .filter(role => role.id !== interaction.guild.roles.everyone.id)
            .sort((first, second) => second.position - first.position)
            .map(role => `${role}`)
        const shownRoles = roles.slice(0, 10)
        const extraRoles = roles.length - shownRoles.length
        const timeoutTimestamp = member.communicationDisabledUntilTimestamp
            ? Math.floor(member.communicationDisabledUntilTimestamp / 1000)
            : null

        const embed = new EmbedBuilder()
            .setColor(member.displayColor || "#5865f2")
            .setAuthor({
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL() || undefined
            })
            .setTitle(`Member profile — ${member.displayName}`)
            .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: "Account",
                    value:
                        `**Username:** ${member.user.tag}\n` +
                        `**Display name:** ${member.displayName}\n` +
                        `**User ID:** \`${member.id}\`\n` +
                        `**Created:** <t:${accountCreated}:D> ` +
                        `(<t:${accountCreated}:R>)`
                },
                {
                    name: "Server membership",
                    value:
                        `**Joined:** ${
                            joinedServer
                                ? `<t:${joinedServer}:D> (<t:${joinedServer}:R>)`
                                : "Unknown"
                        }\n` +
                        `**Highest role:** ${member.roles.highest}\n` +
                        `**Nickname:** ${member.nickname || "None"}`,
                    inline: true
                },
                {
                    name: "Moderation status",
                    value:
                        `**Warnings:** ${warningCount}\n` +
                        `**Timed out:** ${
                            timeoutTimestamp
                                ? `Until <t:${timeoutTimestamp}:F>`
                                : "No"
                        }\n` +
                        `**Bot account:** ${member.user.bot ? "Yes" : "No"}`,
                    inline: true
                },
                {
                    name: `Roles (${roles.length})`,
                    value:
                        shownRoles.length > 0
                            ? `${shownRoles.join(" ")}${
                                  extraRoles > 0
                                      ? `\n…and ${extraRoles} more`
                                      : ""
                              }`
                            : "No additional roles"
                },
                {
                    name: `Recent moderation cases (${moderationCases.length})`,
                    value: formatModerationCases(moderationCases)
                }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`
            })
            .setTimestamp()

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })
    }
}
