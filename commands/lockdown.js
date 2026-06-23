const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} = require("discord.js")
const {
    getLogChannel,
    getLogChannelId
} = require("../utils/logSettings")
const {
    finishLockdown,
    getLockdownState,
    recordLockedChannel,
    snapshotPermissions,
    startLockdown
} = require("../utils/lockdownState")

const lockPermissions = {
    SendMessages: false,
    AddReactions: false,
    SendMessagesInThreads: false,
    CreatePublicThreads: false,
    CreatePrivateThreads: false
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("lockdown")
        .setDescription("Lock all text channels in the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const canManageChannels = interaction.memberPermissions.has(
            PermissionFlagsBits.ManageChannels
        )

        if (!isOwner && !canManageChannels) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators with Manage Channels can use `/lockdown`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const existingState = getLockdownState(interaction.guild.id)
        if (existingState?.active) {
            return interaction.reply({
                content:
                    "A server lockdown is already active. Use `/unlock scope:lockdown` to reverse it first.",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const everyoneRole = interaction.guild.roles.everyone
        const logChannelId = getLogChannelId(interaction.guild.id)
        startLockdown(interaction.guild.id, interaction.user.id)
        const eligibleChannels = interaction.guild.channels.cache
            .filter(
                channel =>
                    channel.type === ChannelType.GuildText ||
                    channel.type === ChannelType.GuildAnnouncement
            )
            .sort((first, second) => first.rawPosition - second.rawPosition)

        const results = {
            locked: [],
            alreadyLocked: [],
            skipped: [],
            failed: []
        }

        for (const channel of eligibleChannels.values()) {
            if (channel.id === logChannelId) {
                results.skipped.push(channel)
                continue
            }

            const overwrite =
                channel.permissionOverwrites.cache.get(everyoneRole.id)

            if (overwrite?.deny.has(PermissionFlagsBits.SendMessages)) {
                results.alreadyLocked.push(channel)
                continue
            }

            try {
                const permissionSnapshot = snapshotPermissions(
                    channel,
                    everyoneRole.id
                )

                await channel.permissionOverwrites.edit(
                    everyoneRole,
                    lockPermissions,
                    {
                        reason:
                            `Server lockdown enabled by ` +
                            interaction.user.tag
                    }
                )
                recordLockedChannel(
                    interaction.guild.id,
                    channel,
                    permissionSnapshot
                )
                results.locked.push(channel)
            } catch (error) {
                console.error(
                    `Failed to lock #${channel.name} (${channel.id}):`,
                    error
                )
                results.failed.push(channel)
            }
        }

        if (results.locked.length === 0) {
            finishLockdown(interaction.guild.id, interaction.user.id)
        }

        const summary =
            `Locked **${results.locked.length}** channel(s). ` +
            `Already locked: **${results.alreadyLocked.length}**. ` +
            `Skipped: **${results.skipped.length}**. ` +
            `Failed: **${results.failed.length}**.`

        await interaction.editReply({
            content:
                results.locked.length === 0
                    ? `No new channels were locked. ${summary}`
                    : `Server lockdown enabled. ${summary}`
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#ed4245")
                .setTitle("Server Lockdown Enabled")
                .addFields(
                    {
                        name: "Moderator",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Channels locked",
                        value: `${results.locked.length}`,
                        inline: true
                    },
                    {
                        name: "Summary",
                        value: summary
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
