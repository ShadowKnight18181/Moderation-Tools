const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("purge")
        .setDescription("Purge recent messages from the channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addIntegerOption(option =>
            option
                .setName("amount")
                .setDescription("Amount of messages the bot should purge")
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("contains")
                .setDescription("Only delete messages containing this text")
                .setMaxLength(100)
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName("bots")
                .setDescription("Only delete messages sent by bots")
                .setRequired(false)
        )
        .addBooleanOption(option =>
            option
                .setName("embeds")
                .setDescription("Only delete messages containing embeds")
                .setRequired(false)
        )
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("Only delete messages sent by this user")
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

        if (!interaction.channel?.isTextBased() || !interaction.channel.messages) {
            return interaction.reply({
                content: "Messages cannot be purged in this channel.",
                flags: MessageFlags.Ephemeral
            })
        }

        const amount = interaction.options.getInteger("amount")
        const contains = interaction.options.getString("contains")
        const botsOnly = interaction.options.getBoolean("bots") === true
        const embedsOnly = interaction.options.getBoolean("embeds") === true
        const user = interaction.options.getUser("user")

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const fetchedMessages = await interaction.channel.messages.fetch({
            limit: 100
        })

        const matchingMessages = fetchedMessages.filter(message => {
            if (contains && !message.content.toLowerCase().includes(
                contains.toLowerCase()
            )) {
                return false
            }

            if (botsOnly && !message.author.bot) return false
            if (embedsOnly && message.embeds.length === 0) return false
            if (user && message.author.id !== user.id) return false

            return true
        }).first(amount)

        if (matchingMessages.length === 0) {
            return interaction.editReply({
                content: "No recent messages matched those filters."
            })
        }

        const deletedMessages = await interaction.channel.bulkDelete(
            matchingMessages,
            true
        )

        await interaction.editReply({
            content: `Deleted ${deletedMessages.size} message(s).`
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const filters = [
                contains ? `Contains: \`${contains}\`` : null,
                botsOnly ? "Bots only" : null,
                embedsOnly ? "Embeds only" : null,
                user ? `User: ${user}` : null
            ].filter(Boolean)

            const embed = new EmbedBuilder()
                .setColor("#fee75c")
                .setTitle("Messages Purged")
                .addFields(
                    {
                        name: "Channel",
                        value: `${interaction.channel}`,
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
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
