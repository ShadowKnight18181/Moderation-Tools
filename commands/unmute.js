const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unmute")
        .setDescription("Remove a member's active mute")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to unmute")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for removing the mute")
                .setRequired(false)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ModerateMembers
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to unmute members.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("member")
        const reason =
            interaction.options.getString("reason") || "No reason provided"

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            member.id === interaction.guild.ownerId ||
            member.roles.highest.position >= interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content: "You cannot unmute a member with an equal or higher role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.moderatable) {
            return interaction.reply({
                content:
                    "I cannot unmute that member. Check my role position and permissions.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.isCommunicationDisabled()) {
            return interaction.reply({
                content: `${member} is not currently muted.`,
                flags: MessageFlags.Ephemeral
            })
        }

        await member.timeout(
            null,
            `${reason} | Moderator: ${interaction.user.tag}`
        )

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId: member.id,
            moderatorId: interaction.user.id,
            type: "UNMUTE",
            reason
        })

        await member.send({
            content:
                `Your mute in **${interaction.guild.name}** was removed.\n` +
                `Reason: **${reason}**`
        }).catch(() => {})

        await interaction.reply({
            content: `${member} was unmuted. Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("Member Unmuted")
                .addFields(
                    { name: "Member", value: `${member}`, inline: true },
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    { name: "Reason", value: reason },
                    { name: "Case ID", value: modCase.id }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
