const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} = require("discord.js")
const { getLogChannel } = require("../utils/logSettings")

function parseSlowmode(input) {
    const value = input.trim().toLowerCase()

    if (["off", "0", "0s"].includes(value)) return 0

    const match = value.match(/^(\d+)(s|m|h)$/)
    if (!match) return null

    const amount = Number(match[1])
    const units = {
        s: 1,
        m: 60,
        h: 3_600
    }
    const seconds = amount * units[match[2]]

    if (amount < 1 || seconds > 21_600) return null

    return seconds
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("slowmode")
        .setDescription("Manage channel slowmode")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option
                .setName("time")
                .setDescription("Slowmode duration: 30s, 5m, 2h, or off")
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Channel to update; defaults to this channel")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const canManageChannels = interaction.memberPermissions.has(
            PermissionFlagsBits.ManageChannels
        )

        if (!isOwner && !canManageChannels) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators with Manage Channels can use `/slowmode`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const channel =
            interaction.options.getChannel("channel") || interaction.channel

        if (
            !channel?.isTextBased() ||
            typeof channel.setRateLimitPerUser !== "function"
        ) {
            return interaction.reply({
                content: "Slowmode cannot be changed in this channel.",
                flags: MessageFlags.Ephemeral
            })
        }

        const time = interaction.options.getString("time")
        const seconds = parseSlowmode(time)

        if (seconds === null) {
            return interaction.reply({
                content:
                    "Use a valid time such as `30s`, `5m`, `2h`, or `off`. Maximum: 6 hours.",
                flags: MessageFlags.Ephemeral
            })
        }

        await channel.setRateLimitPerUser(
            seconds,
            `Slowmode changed by ${interaction.user.tag}`
        )

        await interaction.reply({
            content:
                seconds === 0
                    ? `Slowmode was disabled in ${channel}.`
                    : `Slowmode in ${channel} was set to **${time}**.`,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(seconds === 0 ? "#57f287" : "#fee75c")
                .setTitle(
                    seconds === 0 ? "Slowmode Disabled" : "Slowmode Updated"
                )
                .addFields(
                    {
                        name: "Channel",
                        value: `${channel}`,
                        inline: true
                    },
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Slowmode",
                        value: seconds === 0 ? "Off" : time
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
