const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")
const { getLogChannel } = require("../utils/logSettings")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("kick")
        .setDescription("Kick a member from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to kick")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the kick")
                .setRequired(true)
        ),

    async execute(interaction) {
        const member = interaction.options.getMember("member")
        const reason = interaction.options.getString("reason")

        if (!interaction.memberPermissions.has(PermissionFlagsBits.KickMembers)) {
            return interaction.reply({
                content: "You do not have permission to kick members.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: "You cannot kick yourself.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            member.id === interaction.guild.ownerId ||
            member.roles.highest.position >= interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content: "You cannot kick a member with an equal or higher role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.kickable) {
            return interaction.reply({
                content:
                    "I cannot kick that member. Check my role position and permissions.",
                flags: MessageFlags.Ephemeral
            })
        }

        const memberMention = `<@${member.id}>`
        const memberTag = member.user.tag
        const memberId = member.id

        await member.send({
            content:
                `You were kicked from **${interaction.guild.name}**.\n` +
                `Reason: **${reason}**`
        }).catch(() => {})

        await member.kick(
            `${reason} | Moderator: ${interaction.user.tag}`
        )

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId: memberId,
            moderatorId: interaction.user.id,
            type: "KICK",
            reason
        })

        await interaction.reply({
            content: `${memberTag} was kicked. Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#f0b232")
                .setTitle("Member Kicked")
                .addFields(
                    {
                        name: "Member",
                        value: `${memberMention}\n${memberTag}\n\`${memberId}\``,
                        inline: true
                    },
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Reason",
                        value: reason
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
