const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")
const { addTempBan } = require("../utils/tempBans")
const { getLogChannel } = require("../utils/logSettings")

function parseDuration(input) {
    const match = input.trim().toLowerCase().match(/^(\d+)(m|h|d)$/)
    if (!match) return null

    const amount = Number(match[1])
    const units = {
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000
    }
    const duration = amount * units[match[2]]

    if (amount < 1 || duration > 365 * units.d) return null
    return duration
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("tempban")
        .setDescription("Temporarily ban a member from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to temporarily ban")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("time")
                .setDescription("Duration, such as 30m, 2h, or 7d")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the temporary ban")
                .setMaxLength(400)
                .setRequired(true)
        )
        .addIntegerOption(option =>
            option
                .setName("delete-messages")
                .setDescription("How many days of messages to delete")
                .setRequired(false)
                .addChoices(
                    { name: "Don't delete messages", value: 0 },
                    { name: "Previous 1 day", value: 1 },
                    { name: "Previous 3 days", value: 3 },
                    { name: "Previous 7 days", value: 7 }
                )
        ),

    async execute(interaction) {
        const member = interaction.options.getMember("member")
        const durationName = interaction.options.getString("time")
        const duration = parseDuration(durationName)
        const reason = interaction.options.getString("reason")
        const deleteDays =
            interaction.options.getInteger("delete-messages") || 0

        if (!duration) {
            return interaction.reply({
                content:
                    "Use a valid duration such as `30m`, `2h`, or `7d`. Maximum: 365 days.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)) {
            return interaction.reply({
                content: "You do not have permission to ban members.",
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
                content: "You cannot ban yourself.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            member.id === interaction.guild.ownerId ||
            member.roles.highest.position >=
                interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content:
                    "You cannot ban a member with an equal or higher role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.bannable) {
            return interaction.reply({
                content:
                    "I cannot ban that member. Check my role position and permissions.",
                flags: MessageFlags.Ephemeral
            })
        }

        const memberTag = member.user.tag
        const memberId = member.id
        const memberAvatar = member.user.displayAvatarURL()
        const expiresAt = new Date(Date.now() + duration).toISOString()

        await member.send({
            content:
                `You were temporarily banned from **${interaction.guild.name}** ` +
                `for **${durationName}**.\nReason: **${reason}**`
        }).catch(() => {})

        await member.ban({
            deleteMessageSeconds: deleteDays * 86_400,
            reason: `${reason} | Moderator: ${interaction.user.tag}`
        })

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId: memberId,
            moderatorId: interaction.user.id,
            type: "TEMPBAN",
            reason,
            details: {
                duration: durationName,
                expiresAt,
                deleteDays
            }
        })

        addTempBan(interaction.client, {
            guildId: interaction.guild.id,
            userId: memberId,
            expiresAt,
            caseId: modCase.id
        })

        await interaction.reply({
            content:
                `${memberTag} was temporarily banned for **${durationName}**. ` +
                `Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const expiryTimestamp = Math.floor(
                new Date(expiresAt).getTime() / 1000
            )
            const embed = new EmbedBuilder()
                .setColor("#f0b232")
                .setTitle("Member Temporarily Banned")
                .setThumbnail(memberAvatar)
                .addFields(
                    {
                        name: "Member",
                        value: `${memberTag}\n\`${memberId}\``,
                        inline: true
                    },
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    { name: "Reason", value: reason },
                    {
                        name: "Duration",
                        value:
                            `${durationName}\nExpires ` +
                            `<t:${expiryTimestamp}:R>`
                    },
                    {
                        name: "Messages deleted",
                        value: deleteDays
                            ? `Previous ${deleteDays} day(s)`
                            : "None"
                    },
                    { name: "Case ID", value: modCase.id }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
