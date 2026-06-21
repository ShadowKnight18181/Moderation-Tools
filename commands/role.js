const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("role")
        .setDescription("Manage a member's roles")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Remove a role from a member")
                .addUserOption(option =>
                    option
                        .setName("user")
                        .setDescription("Member to remove the role from")
                        .setRequired(true)
                )
                .addRoleOption(option =>
                    option
                        .setName("role")
                        .setDescription("Role to remove")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const canManageRoles = interaction.memberPermissions.has(
            PermissionFlagsBits.ManageRoles
        )

        if (!isOwner && !canManageRoles) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators with Manage Roles can use this command.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("user")
        const role = interaction.options.getRole("role")
        const botMember = interaction.guild.members.me

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (role.id === interaction.guild.roles.everyone.id) {
            return interaction.reply({
                content: "The `@everyone` role cannot be removed.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (role.managed) {
            return interaction.reply({
                content: "That role is managed by Discord or an integration.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            !isOwner &&
            (member.id === interaction.guild.ownerId ||
                member.roles.highest.position >=
                    interaction.member.roles.highest.position)
        ) {
            return interaction.reply({
                content:
                    "You cannot change roles for a member with an equal or higher role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            !isOwner &&
            role.position >= interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "You cannot remove a role equal to or higher than your highest role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            !botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            role.position >= botMember.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "I cannot remove that role. Move my bot role above it and grant Manage Roles.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.roles.cache.has(role.id)) {
            return interaction.reply({
                content: `${member} does not have the ${role} role.`,
                flags: MessageFlags.Ephemeral
            })
        }

        await member.roles.remove(
            role,
            `Removed by ${interaction.user.tag}`
        )

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId: member.id,
            moderatorId: interaction.user.id,
            type: "ROLE REMOVE",
            reason: `Removed the ${role.name} role`,
            details: {
                roleId: role.id,
                roleName: role.name
            }
        })

        await interaction.reply({
            content:
                `Removed ${role} from ${member}. Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setTitle("Role Removed")
                .addFields(
                    {
                        name: "Member",
                        value: `${member}`,
                        inline: true
                    },
                    {
                        name: "Role",
                        value: `${role}`,
                        inline: true
                    },
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Case ID",
                        value: modCase.id
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
