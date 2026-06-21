const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const {
    getModCase,
    getUserCases,
    closeModCase,
    deleteModCase
} = require("../utils/modCases")
const { isWarningActive } = require("../utils/warningStatus")
const { reverseModCase } = require("../utils/reverseCase")

const caseStyles = {
    WARN: { color: "#fee75c", label: "WARNING" },
    MUTE: { color: "#f0b232", label: "MUTE" },
    UNMUTE: { color: "#57f287", label: "UNMUTE" },
    KICK: { color: "#e67e22", label: "KICK" },
    BAN: { color: "#ed4245", label: "BAN" },
    UNBAN: { color: "#57f287", label: "UNBAN" },
    "ROLE REMOVE": { color: "#9b59b6", label: "ROLE REMOVAL" }
}

function getCaseStyle(type) {
    return caseStyles[type] || { color: "#5865f2", label: type }
}

function formatDetails(details) {
    const labels = {
        duration: "Duration",
        deleteDays: "Message history deleted",
        roleId: "Role ID",
        roleName: "Role",
        warningId: "Warning ID"
    }
    const entries = Object.entries(details || {})

    if (entries.length === 0) return null

    return entries
        .map(([key, originalValue]) => {
            let value = originalValue
            if (key === "deleteDays") {
                value = value ? `${value} day(s)` : "None"
            }
            return `**${labels[key] || key}:** ${value}`
        })
        .join("\n")
}

function getDuration(modCase) {
    if (modCase.details?.duration) return modCase.details.duration
    if (modCase.type === "BAN") return "Permanent"
    if (modCase.type === "WARN") return "Permanent"
    if (modCase.type === "KICK") return "Not applicable"
    if (modCase.type === "UNBAN" || modCase.type === "UNMUTE") {
        return "Removed"
    }
    return "Not specified"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("case")
        .setDescription("View moderation cases")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("View a moderation case")
                .addStringOption(option =>
                    option
                        .setName("case")
                        .setDescription("Case ID you would like to view")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("view_user")
                .setDescription("View a member's moderation cases")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Member whose cases you want to view")
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("close")
                .setDescription("Mark a moderation case as closed")
                .addStringOption(option =>
                    option
                        .setName("case")
                        .setDescription("Case ID you would like to close")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("reason")
                        .setDescription("Reason for closing the case")
                        .setMaxLength(400)
                        .setRequired(false)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("delete")
                .setDescription("Delete a case from moderation case views")
                .addStringOption(option =>
                    option
                        .setName("case")
                        .setDescription("Case ID you would like to delete")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("reason")
                        .setDescription("Reason for deleting the case")
                        .setMaxLength(400)
                        .setRequired(false)
                )
        ),

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

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === "delete") {
            if (!isOwner) {
                return interaction.reply({
                    content: "Only the server owner can delete cases.",
                    flags: MessageFlags.Ephemeral
                })
            }

            const caseId = interaction.options.getString("case").trim()
            const deleteReason =
                interaction.options.getString("reason") ||
                "No deletion reason provided"
            const modCase = getModCase(interaction.guild.id, caseId)

            if (!modCase) {
                return interaction.reply({
                    content:
                        `No moderation case with ID \`${caseId}\` was found.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            const reversal = await reverseModCase(
                interaction,
                modCase,
                deleteReason
            )

            if (!reversal.success) {
                return interaction.reply({
                    content:
                        `Case \`${modCase.id}\` was not deleted.\n` +
                        `Reason: ${reversal.message}`,
                    flags: MessageFlags.Ephemeral
                })
            }

            const deletedCase = deleteModCase(
                interaction.guild.id,
                caseId,
                interaction.user.id,
                deleteReason
            )

            if (!deletedCase) {
                return interaction.reply({
                    content:
                        `No moderation case with ID \`${caseId}\` was found.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            return interaction.reply({
                content:
                    `Deleted case \`${deletedCase.id}\` from case views.\n` +
                    `${reversal.message}\n` +
                    `Deletion reason: ${deleteReason}`,
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === "close") {
            const caseId = interaction.options.getString("case").trim()
            const closeReason =
                interaction.options.getString("reason") ||
                "No closing reason provided"
            const result = closeModCase(
                interaction.guild.id,
                caseId,
                interaction.user.id,
                closeReason
            )

            if (!result) {
                return interaction.reply({
                    content:
                        `No moderation case with ID \`${caseId}\` was found.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            if (result.alreadyClosed) {
                return interaction.reply({
                    content: `Case \`${result.modCase.id}\` is already closed.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            return interaction.reply({
                content:
                    `Closed case \`${result.modCase.id}\`.\n` +
                    `Reason: ${closeReason}`,
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === "view_user") {
            const member = interaction.options.getMember("user")

            if (!member) {
                return interaction.reply({
                    content: "That member could not be found in this server.",
                    flags: MessageFlags.Ephemeral
                })
            }

            const cases = getUserCases(interaction.guild.id, member.id)

            if (cases.length === 0) {
                return interaction.reply({
                    content: `${member} has no moderation cases recorded by this bot.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            const displayedCases = cases.slice(0, 10)
            const caseList = displayedCases
                .map(modCase => {
                    const style = getCaseStyle(modCase.type)
                    const timestamp = Math.floor(
                        new Date(modCase.createdAt).getTime() / 1000
                    )
                    const reason =
                        modCase.reason.length > 80
                            ? `${modCase.reason.slice(0, 77)}...`
                            : modCase.reason

                    return (
                        `**${style.label}** | \`${modCase.id}\` | ` +
                        `<t:${timestamp}:R>\n${reason} - ` +
                        `<@${modCase.moderatorId}>`
                    )
                })
                .join("\n\n")

            const embed = new EmbedBuilder()
                .setColor(member.displayColor || "#5865f2")
                .setTitle(`Moderation history - ${member.displayName}`)
                .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
                .setDescription(caseList)
                .setFooter({
                    text:
                        `${cases.length} total case(s)` +
                        (cases.length > displayedCases.length
                            ? " | Showing the 10 most recent"
                            : "")
                })
                .setTimestamp()

            return interaction.reply({
                embeds: [embed],
                flags: MessageFlags.Ephemeral
            })
        }

        const caseId = interaction.options.getString("case").trim()
        const modCase = getModCase(interaction.guild.id, caseId)

        if (!modCase) {
            return interaction.reply({
                content: `No moderation case with ID \`${caseId}\` was found.`,
                flags: MessageFlags.Ephemeral
            })
        }

        const timestamp = Math.floor(
            new Date(modCase.createdAt).getTime() / 1000
        )
        const user = await interaction.client.users
            .fetch(modCase.userId)
            .catch(() => null)
        const moderator = await interaction.client.users
            .fetch(modCase.moderatorId)
            .catch(() => null)
        const style = getCaseStyle(modCase.type)
        const duration = getDuration(modCase)
        const closedTimestamp = modCase.closedAt
            ? Math.floor(new Date(modCase.closedAt).getTime() / 1000)
            : null
        const warningActive = isWarningActive(
            interaction.guild.id,
            modCase
        )
        const status =
            warningActive === false
                ? "Removed"
                : modCase.closedAt
                  ? `Closed <t:${closedTimestamp}:R>\n` +
                    `By <@${modCase.closedBy}>`
                  : warningActive === true
                    ? "Active warning"
                    : "Open"

        const embed = new EmbedBuilder()
            .setColor(style.color)
            .setTitle("Case Information")
            .setThumbnail(user?.displayAvatarURL({ size: 256 }) || null)
            .addFields(
                {
                    name: "Case ID",
                    value: `\`${modCase.id}\``,
                    inline: true
                },
                {
                    name: "Type",
                    value: style.label,
                    inline: true
                },
                {
                    name: "Member",
                    value:
                        `${user ? user.tag : "Unknown user"}\n` +
                        `<@${modCase.userId}>`,
                    inline: true
                },
                {
                    name: "Moderator",
                    value:
                        `${moderator ? moderator.tag : "Unknown moderator"}\n` +
                        `<@${modCase.moderatorId}>`,
                    inline: true
                },
                {
                    name: "Duration",
                    value: duration,
                    inline: true
                },
                {
                    name: "Date",
                    value: `<t:${timestamp}:F>\n<t:${timestamp}:R>`,
                    inline: true
                },
                {
                    name: "Status",
                    value: status,
                    inline: true
                },
                {
                    name: "Reason",
                    value: modCase.reason || "No reason provided"
                }
            )
            .setFooter({
                text: `Requested by ${interaction.user.tag}`
            })

        if (modCase.closedAt) {
            embed.addFields({
                name: "Closing reason",
                value: modCase.closeReason || "No closing reason provided"
            })
        }

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })
    }
}
