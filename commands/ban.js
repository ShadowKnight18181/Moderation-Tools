const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")


function parseDuration(input) {
    const value = input.trim().toLowerCase()

    if (value === "permanent") return null

    const match = value.match(/^(\d+)(m|h|d)$/)
    if (!match) return undefined

    const amount = Number(match[1])
    const units = {
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000
    }

    return amount * units[match[2]]
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("ban")
        .setDescription("Ban a member from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to ban")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("time")
                .setDescription("Ban duration: 30m, 2h, 7d, or permanent")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the ban")
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
        const time = interaction.options.getString("time")
        const duration = parseDuration(time)
        const reason = interaction.options.getString("reason")
        const deleteDays =
            interaction.options.getInteger("delete-messages") || 0

        if (duration === undefined) {
            return interaction.reply({
                content:
                    "Invalid duration. Use `30m`, `2h`, `7d`, or `permanent`.",
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

        await member.send({
            content:
                `You were banned from **${interaction.guild.name}**.\n` +
                `Reason: **${reason}**`
        }).catch(() => {})

        await member.ban({
            deleteMessageSeconds: deleteDays * 86_400,
            reason: `${reason} | Moderator: ${interaction.user.tag}`
        })

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId: memberId,
            moderatorId: interaction.user.id,
            type: "BAN",
            reason,
            details: {
                duration: time,
                deleteDays
            }
        })

        if (duration !== null) {
            setTimeout(async () => {
                await interaction.guild.bans
                    .remove(memberId, "Temporary ban expired")
                    .catch(console.error)
            }, duration)
        }

        await interaction.reply({
            content: `${memberTag} was banned. Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setTitle("Member Banned")
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
                    {
                        name: "Reason",
                        value: reason
                    },
                    {
                        name: "Messages deleted",
                        value: deleteDays
                            ? `Previous ${deleteDays} day(s)`
                            : "None"
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
