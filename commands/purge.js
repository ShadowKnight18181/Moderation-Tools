const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} = require("discord.js")
const { getLogChannel } = require("../utils/logSettings")
const { suppressDeletion } = require("../utils/antiSpam")

const allowedFilters = new Set([
    "bot",
    "user",
    "not_pinned",
    "embed",
    "attachment",
    "link"
])
const linkPattern = /(?:https?:\/\/|www\.)\S+/i
const maximumMessagesToScan = 500
const bulkDeleteLimit = 14 * 24 * 60 * 60 * 1_000

function parseFilters(input) {
    if (!input) return { filters: [], invalid: [] }

    const filters = [
        ...new Set(
            input
                .toLowerCase()
                .split(",")
                .map(filter => filter.trim())
                .filter(Boolean)
        )
    ]
    const invalid = filters.filter(filter => !allowedFilters.has(filter))

    return { filters, invalid }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Purge recent messages from the channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option
                .setName("count")
                .setDescription("Number of matching messages to purge")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Only delete messages sent by this user")
                .setRequired(false)
        )
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription("Channel to purge; defaults to this channel")
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Optional reason for the purge")
                .setMaxLength(400)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("filters")
                .setDescription(
                    "Comma-separated: bot,user,not_pinned,embed,attachment,link"
                )
                .setMaxLength(100)
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("contains")
                .setDescription("Only delete messages containing this text")
                .setMaxLength(100)
                .setRequired(false)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageMessages
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to purge messages.",
                flags: MessageFlags.Ephemeral
            })
        }

        const channel =
            interaction.options.getChannel("channel") || interaction.channel

        if (!channel?.isTextBased() || !channel.messages) {
            return interaction.reply({
                content: "Messages cannot be purged in this channel.",
                flags: MessageFlags.Ephemeral
            })
        }

        const botMember = interaction.guild.members.me
        const botPermissions = channel.permissionsFor(botMember)

        if (
            !botPermissions?.has(PermissionFlagsBits.ViewChannel) ||
            !botPermissions.has(PermissionFlagsBits.ReadMessageHistory) ||
            !botPermissions.has(PermissionFlagsBits.ManageMessages)
        ) {
            return interaction.reply({
                content:
                    "I need View Channel, Read Message History, and Manage Messages in that channel.",
                flags: MessageFlags.Ephemeral
            })
        }

        const count = interaction.options.getInteger("count")
        const user = interaction.options.getUser("user")
        const reason =
            interaction.options.getString("reason") || "No reason provided"
        const filterInput = interaction.options.getString("filters")
        const contains = interaction.options.getString("contains")
        const { filters, invalid } = parseFilters(filterInput)

        if (invalid.length) {
            return interaction.reply({
                content:
                    `Unknown filter(s): ${invalid
                        .map(filter => `\`${filter}\``)
                        .join(", ")}.\n` +
                    "Valid filters: `bot`, `user`, `not_pinned`, `embed`, `attachment`, `link`.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (filters.includes("bot") && filters.includes("user")) {
            return interaction.reply({
                content:
                    "The `bot` and `user` filters cannot be used together.",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const matchingMessages = []
        let before
        let scanned = 0
        const oldestAllowedTimestamp = Date.now() - bulkDeleteLimit

        while (
            matchingMessages.length < count &&
            scanned < maximumMessagesToScan
        ) {
            const fetchedMessages = await channel.messages.fetch({
                limit: Math.min(100, maximumMessagesToScan - scanned),
                before
            })

            if (fetchedMessages.size === 0) break

            scanned += fetchedMessages.size
            before = fetchedMessages.last().id

            for (const message of fetchedMessages.values()) {
                if (message.createdTimestamp <= oldestAllowedTimestamp) {
                    continue
                }

                // Pinned messages are always protected, even without the
                // explicit not_pinned filter.
                if (message.pinned) continue
                if (user && message.author.id !== user.id) continue
                if (filters.includes("bot") && !message.author.bot) continue
                if (filters.includes("user") && message.author.bot) continue
                if (filters.includes("embed") && message.embeds.length === 0) {
                    continue
                }
                if (
                    filters.includes("attachment") &&
                    message.attachments.size === 0
                ) {
                    continue
                }
                if (
                    filters.includes("link") &&
                    !linkPattern.test(message.content)
                ) {
                    continue
                }
                if (
                    contains &&
                    !message.content
                        .toLowerCase()
                        .includes(contains.toLowerCase())
                ) {
                    continue
                }

                matchingMessages.push(message)
                if (matchingMessages.length >= count) break
            }

            if (
                fetchedMessages.last().createdTimestamp <=
                oldestAllowedTimestamp
            ) {
                break
            }
        }

        if (matchingMessages.length === 0) {
            return interaction.editReply({
                content:
                    "No deletable messages matched those filters. Messages older than 14 days and pinned messages are preserved."
            })
        }

        matchingMessages.forEach(message => suppressDeletion(message.id))

        const deletedMessages = await channel.bulkDelete(
            matchingMessages,
            true
        )

        await interaction.editReply({
            content:
                `Deleted ${deletedMessages.size} message(s) from ${channel}. ` +
                `Scanned ${scanned} recent message(s).`
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const filters = [
                contains ? `Contains: \`${contains}\`` : null,
                user ? `Target user: ${user}` : null,
                filterInput ? `Filters: \`${filterInput}\`` : null
            ].filter(Boolean)

            const embed = new EmbedBuilder()
                .setColor("#fee75c")
                .setTitle("Messages Purged")
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
                        name: "Messages deleted",
                        value: `${deletedMessages.size}`,
                        inline: true
                    },
                    {
                        name: "Filters",
                        value: filters.length ? filters.join("\n") : "None"
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
