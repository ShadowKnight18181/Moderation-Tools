const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { getGuildCases } = require("../utils/modCases")
const { isWarningActive } = require("../utils/warningStatus")

const caseIcons = {
    WARN: "⚠️",
    MUTE: "🔇",
    UNMUTE: "🔊",
    KICK: "👢",
    BAN: "🔨",
    UNBAN: "✅",
    "ROLE REMOVE": "🏷️"
}

function getDuration(modCase) {
    if (modCase.details?.duration) return modCase.details.duration
    if (modCase.type === "BAN") return "Permanent"
    if (modCase.type === "WARN") return "Permanent"
    if (modCase.type === "KICK") return "N/A"
    if (modCase.type === "UNBAN" || modCase.type === "UNMUTE") {
        return "Removed"
    }
    return "Not specified"
}

function getCaseSummary(cases) {
    const totals = {}

    for (const modCase of cases) {
        totals[modCase.type] = (totals[modCase.type] || 0) + 1
    }

    return Object.entries(totals)
        .sort((first, second) => second[1] - first[1])
        .map(([type, count]) => {
            const icon = caseIcons[type] || "📋"
            return `${icon} ${type}: **${count}**`
        })
        .join(" • ")
        .slice(0, 1024)
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("caselist")
        .setDescription("View recent moderation cases in this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const isModerator = interaction.memberPermissions.has(
            PermissionFlagsBits.ModerateMembers
        )

        if (!isOwner && !isModerator) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators can view cases.",
                flags: MessageFlags.Ephemeral
            })
        }

        const cases = getGuildCases(interaction.guild.id)

        if (cases.length === 0) {
            return interaction.reply({
                content: "No moderation cases have been recorded yet.",
                flags: MessageFlags.Ephemeral
            })
        }

        const displayedCases = cases.slice(0, 12)
        const caseList = displayedCases
            .map(modCase => {
                const icon = caseIcons[modCase.type] || "📋"
                const timestamp = Math.floor(
                    new Date(modCase.createdAt).getTime() / 1000
                )
                const reason =
                    modCase.reason.length > 65
                        ? `${modCase.reason.slice(0, 62)}...`
                        : modCase.reason
                const warningActive = isWarningActive(
                    interaction.guild.id,
                    modCase
                )
                const status =
                    warningActive === false
                        ? "Removed"
                        : modCase.closedAt
                          ? "Closed"
                          : "Open"
                const duration = getDuration(modCase)

                return (
                    `${icon} **${modCase.type}** • \`${modCase.id}\` • ` +
                    `**${status}** • <t:${timestamp}:R>\n` +
                    `<@${modCase.userId}> — ${reason}\n` +
                    `Duration: **${duration}** • Moderator: ` +
                    `<@${modCase.moderatorId}>`
                )
            })
            .join("\n\n")

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setAuthor({
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL() || undefined
            })
            .setTitle(`Moderation cases — ${cases.length} total`)
            .setDescription(caseList)
            .addFields({
                name: "Case breakdown",
                value: getCaseSummary(cases)
            })
            .setFooter({
                text:
                    (cases.length > displayedCases.length
                        ? "Showing the 12 most recent • "
                        : "") +
                    "Use /case view with a case ID for full details"
            })
            .setTimestamp()

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })
    }
}
