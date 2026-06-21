const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock a channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Channel to unlock; defaults to this channel")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for unlocking the channel")
                .setMaxLength(400)
                .setRequired(false)
        ),

    async execute(interaction) {
        const reason =
            interaction.options.getString("reason") || "No reason provided"
        const channel =
            interaction.options.getChannel("channel") || interaction.channel

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageChannels
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to unlock channels.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!channel?.permissionOverwrites) {
            return interaction.reply({
                content: "This channel cannot be unlocked.",
                flags: MessageFlags.Ephemeral
            })
        }

        const everyoneRole = interaction.guild.roles.everyone
        const overwrite =
            channel.permissionOverwrites.cache.get(everyoneRole.id)

        if (!overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                content: "This channel is not locked.",
                flags: MessageFlags.Ephemeral
            })
        }

        await channel.permissionOverwrites.edit(
            everyoneRole,
            {
                SendMessages: null,
                AddReactions: null,
                SendMessagesInThreads: null,
                CreatePublicThreads: null,
                CreatePrivateThreads: null
            },
            {
                reason: `${reason} | Moderator: ${interaction.user.tag}`
            }
        )

        await interaction.reply({
            content: `🔓 ${channel} has been unlocked.`,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("Channel Unlocked")
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
                        name: "Reason",
                        value: reason
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
