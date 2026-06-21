const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")

const highlightedPermissions = [
    ["Administrator", "Administrator"],
    ["ManageGuild", "Manage Server"],
    ["ManageRoles", "Manage Roles"],
    ["ManageChannels", "Manage Channels"],
    ["ManageMessages", "Manage Messages"],
    ["BanMembers", "Ban Members"],
    ["KickMembers", "Kick Members"],
    ["ModerateMembers", "Timeout Members"],
    ["MentionEveryone", "Mention Everyone"],
    ["ManageWebhooks", "Manage Webhooks"],
    ["ViewAuditLog", "View Audit Log"]
]

function getPermissionSummary(role) {
    if (role.permissions.has(PermissionFlagsBits.Administrator)) {
        return (
            "⚠️ **Administrator**\n" +
            "Members with this role can access and manage almost everything " +
            "in the server, even when channel permissions deny access."
        )
    }

    const important = highlightedPermissions
        .filter(([permission]) => role.permissions.has(permission))
        .map(([, label]) => `• ${label}`)

    return important.length
        ? important.join("\n")
        : "This role has no major moderation or management permissions."
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("roleinfo")
        .setDescription("View detailed information about a role")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Role to inspect")
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
                    "Only the server owner or moderators can use `/roleinfo`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const role = interaction.options.getRole("role")
        const createdTimestamp = Math.floor(role.createdTimestamp / 1000)
        const permissionCount = role.permissions.toArray().length
        const color =
            role.hexColor === "#000000" ? "#5865f2" : role.hexColor
        const roleType = role.managed
            ? "Controlled automatically by a bot or integration"
            : "Created and controlled by server staff"

        const embed = new EmbedBuilder()
            .setColor(color)
            .setAuthor({
                name: interaction.guild.name,
                iconURL: interaction.guild.iconURL() || undefined
            })
            .setTitle(`Information about ${role.name}`)
            .setDescription(`${role}`)
            .addFields(
                {
                    name: "Basic details",
                    value:
                        `**ID:** \`${role.id}\`\n` +
                        `**Color:** \`${role.hexColor}\`\n` +
                        `**Created:** <t:${createdTimestamp}:D> ` +
                        `(<t:${createdTimestamp}:R>)`
                },
                {
                    name: "Who has this role?",
                    value:
                        role.members.size === 1
                            ? "**1 member** currently has this role."
                            : `**${role.members.size} members** currently have this role.`,
                    inline: true
                },
                {
                    name: "Role hierarchy",
                    value:
                        `Position **#${role.position}** from the bottom.\n` +
                        "Higher roles can manage lower roles.",
                    inline: true
                },
                {
                    name: "How it behaves",
                    value:
                        `**Shown separately in member list:** ${
                            role.hoist ? "Yes" : "No"
                        }\n` +
                        `**Can anyone mention it:** ${
                            role.mentionable ? "Yes" : "No"
                        }\n` +
                        `**Role type:** ${roleType}`
                },
                {
                    name: `Important permissions (${permissionCount} enabled total)`,
                    value: getPermissionSummary(role)
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
