const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")

function parseDuration(input) {
    const match = input.trim().toLowerCase().match(/^(\d+)(s|m|h|d)$/)
    if (!match) return null

    const amount = Number(match[1])

    const units = {
        s: 1_000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000
    }

    const duration = amount * units[match[2]]
    const maximum = 28 * 86_400_000

    if (amount < 1 || duration > maximum) return null

    return duration
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("mute")
        .setDescription("Temporarily mute a server member")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to mute")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("time")
                .setDescription("Mute duration, such as 30s, 15m, 2h, or 3d")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the mute")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ModerateMembers
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to mute members.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("member")
        const durationName = interaction.options.getString("time")
        const reason = interaction.options.getString("reason")
        const duration = parseDuration(durationName)

        if (!duration) {
            return interaction.reply({
                content:
                    "Use a valid time such as `30s`, `15m`, `2h`, or `3d`. " +
                    "Maximum: 28 days.",
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
                content: "You cannot mute yourself.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            member.id === interaction.guild.ownerId ||
            member.roles.highest.position >= interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content: "You cannot mute a member with an equal or higher role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.moderatable) {
            return interaction.reply({
                content:
                    "I cannot mute that member. Check my role position and permissions.",
                flags: MessageFlags.Ephemeral
            })
        }

        await member.send({
            content:
                `You were muted in **${interaction.guild.name}**.\n` +
                `Duration: **${durationName}**\n` +
                `Reason: **${reason}**`
        }).catch(() => {})

        await member.timeout(
            duration,
            `${reason} | Moderator: ${interaction.user.tag}`
        )

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId: member.id,
            moderatorId: interaction.user.id,
            type: "MUTE",
            reason,
            details: {
                duration: durationName
            }
        })

        await interaction.reply({
            content:
                `${member} was muted for **${durationName}**. ` +
                `Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setTitle("Member Muted")
                .addFields(
                    { name: "Member", value: `${member}`, inline: true },
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    { name: "Duration", value: durationName },
                    { name: "Reason", value: reason },
                    { name: "Case ID", value: modCase.id }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
