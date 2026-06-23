const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { getLogChannel } = require("../utils/logSettings")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("delrole")
        .setDescription("Delete a server role")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addRoleOption(option =>
            option
                .setName("role")
                .setDescription("Role to delete")
                .setRequired(true)
        ),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const canManageRoles = interaction.memberPermissions.has(
            PermissionFlagsBits.ManageRoles
        )

        if (!isOwner && !canManageRoles) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators with Manage Roles can use `/delrole`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const role = interaction.options.getRole("role")
        const botMember = interaction.guild.members.me

        if (role.id === interaction.guild.roles.everyone.id) {
            return interaction.reply({
                content: "The `@everyone` role cannot be deleted.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (role.managed) {
            return interaction.reply({
                content:
                    "That role is managed by Discord, a bot, or an integration and cannot be deleted manually.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            role.permissions.has(PermissionFlagsBits.Administrator) &&
            !isOwner
        ) {
            return interaction.reply({
                content:
                    "Only the server owner can delete a role with Administrator permission.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            !isOwner &&
            role.position >= interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "You cannot delete a role equal to or higher than your highest role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            !botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            role.position >= botMember.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "I cannot delete that role. Move my bot role above it and grant Manage Roles.",
                flags: MessageFlags.Ephemeral
            })
        }

        const roleName = role.name
        const roleId = role.id
        const roleColor = role.hexColor === "#000000" ? "#5865f2" : role.hexColor
        const memberCount = role.members.size

        await role.delete(`Deleted by ${interaction.user.tag}`)

        await interaction.reply({
            content: `Deleted the **${roleName}** role.`,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(roleColor)
                .setTitle("Role Deleted")
                .addFields(
                    {
                        name: "Role",
                        value: `${roleName}\n\`${roleId}\``,
                        inline: true
                    },
                    {
                        name: "Deleted by",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Members affected",
                        value: `${memberCount}`,
                        inline: true
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
