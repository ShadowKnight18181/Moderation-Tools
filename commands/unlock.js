const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} = require("discord.js")
const { getLogChannel } = require("../utils/logSettings")
const {
    finishLockdown,
    getLockdownState,
    removeLockedChannel,
    toOverwriteData
} = require("../utils/lockdownState")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unlock")
        .setDescription("Unlock a channel or reverse a server lockdown")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(option =>
            option
                .setName("scope")
                .setDescription("What should be unlocked")
                .addChoices(
                    {
                        name: "Current or selected channel",
                        value: "channel"
                    },
                    {
                        name: "Channels changed by lockdown",
                        value: "lockdown"
                    }
                )
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Channel to unlock; defaults to this channel")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const scope =
            interaction.options.getString("scope") || "channel"
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

        if (scope === "lockdown") {
            if (interaction.options.getChannel("channel")) {
                return interaction.reply({
                    content:
                        "Do not select a channel when using the lockdown scope.",
                    flags: MessageFlags.Ephemeral
                })
            }

            const state = getLockdownState(interaction.guild.id)
            const savedChannels = Object.entries(state?.channels || {})

            if (!state?.active || savedChannels.length === 0) {
                return interaction.reply({
                    content:
                        "There is no active lockdown state to restore.",
                    flags: MessageFlags.Ephemeral
                })
            }

            await interaction.deferReply({
                flags: MessageFlags.Ephemeral
            })

            const everyoneRole = interaction.guild.roles.everyone
            const results = {
                restored: [],
                missing: [],
                failed: []
            }

            for (const [channelId, saved] of savedChannels) {
                const savedChannel =
                    interaction.guild.channels.cache.get(channelId)

                if (!savedChannel?.permissionOverwrites) {
                    results.missing.push(saved.name || channelId)
                    removeLockedChannel(
                        interaction.guild.id,
                        channelId
                    )
                    continue
                }

                try {
                    await savedChannel.permissionOverwrites.edit(
                        everyoneRole,
                        toOverwriteData(saved.permissions),
                        {
                            reason:
                                `Server lockdown reversed by ` +
                                interaction.user.tag
                        }
                    )
                    results.restored.push(savedChannel)
                    removeLockedChannel(
                        interaction.guild.id,
                        channelId
                    )
                } catch (error) {
                    console.error(
                        `Failed to restore #${savedChannel.name} ` +
                            `(${savedChannel.id}):`,
                        error
                    )
                    results.failed.push(savedChannel)
                }
            }

            if (results.failed.length === 0) {
                finishLockdown(
                    interaction.guild.id,
                    interaction.user.id
                )
            }

            const summary =
                `Restored **${results.restored.length}** channel(s). ` +
                `Missing: **${results.missing.length}**. ` +
                `Failed: **${results.failed.length}**.`

            await interaction.editReply({
                content:
                    results.failed.length
                        ? `Lockdown was partially reversed. ${summary}`
                        : `Server lockdown reversed. ${summary}`
            })

            const logChannel = getLogChannel(interaction.guild)
            if (logChannel?.isTextBased()) {
                const embed = new EmbedBuilder()
                    .setColor(
                        results.failed.length ? "#fee75c" : "#57f287"
                    )
                    .setTitle("Server Lockdown Reversed")
                    .addFields(
                        {
                            name: "Moderator",
                            value: `${interaction.user}`,
                            inline: true
                        },
                        {
                            name: "Channels restored",
                            value: `${results.restored.length}`,
                            inline: true
                        },
                        {
                            name: "Summary",
                            value: summary
                        }
                    )
                    .setTimestamp()

                await logChannel
                    .send({ embeds: [embed] })
                    .catch(console.error)
            }
            return
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
        const lockdownState = getLockdownState(interaction.guild.id)
        const savedLockdownChannel =
            lockdownState?.channels?.[channel.id]

        if (!overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
            return interaction.reply({
                content: "This channel is not locked.",
                flags: MessageFlags.Ephemeral
            })
        }

        await channel.permissionOverwrites.edit(
            everyoneRole,
            savedLockdownChannel
                ? toOverwriteData(savedLockdownChannel.permissions)
                : {
                      SendMessages: null,
                      AddReactions: null,
                      SendMessagesInThreads: null,
                      CreatePublicThreads: null,
                      CreatePrivateThreads: null
                  },
            {
                reason: `Channel unlocked by ${interaction.user.tag}`
            }
        )

        removeLockedChannel(interaction.guild.id, channel.id)

        await interaction.reply({
            content: `🔓 ${channel} has been unlocked.`,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

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
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
