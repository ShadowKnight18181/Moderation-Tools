const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ChannelType
} = require("discord.js")

function getEmbedColor(input) {
    if (!input) return "#5865f2"

    if (input.toLowerCase() === "random") {
        return Math.floor(Math.random() * 0xffffff)
    }

    const color = input.startsWith("#") ? input : `#${input}`
    return /^#[0-9a-f]{6}$/i.test(color) ? color : null
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("say")
        .setDescription("Send a message as the bot")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addStringOption(option =>
            option
                .setName("message")
                .setDescription(
                    "Message to send; for an image, put its URL first"
                )
                .setMaxLength(2000)
                .setRequired(true)
        )
        .addChannelOption(option =>
            option
                .setName("channel")
                .setDescription(
                    "Channel to send to; defaults to the current channel"
                )
                .addChannelTypes(
                    ChannelType.GuildText,
                    ChannelType.GuildAnnouncement
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("message_type")
                .setDescription("Send text, an embed, or an embed with an image")
                .addChoices(
                    { name: "Text", value: "text" },
                    { name: "Embed", value: "embed" },
                    { name: "Embed with image", value: "embed-image" }
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("embed_color")
                .setDescription("Embed hex color, such as #5865F2, or random")
                .setRequired(false)
        ),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const isModerator = interaction.memberPermissions.has(
            PermissionFlagsBits.ModerateMembers
        )

        if (!isOwner && !isModerator) {
            return interaction.reply({
                content: "Only the server owner or moderators can use `/say`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const channel =
            interaction.options.getChannel("channel") || interaction.channel
        const messageType =
            interaction.options.getString("message_type") || "text"
        const message = interaction.options.getString("message")
        const embedColor = getEmbedColor(
            interaction.options.getString("embed_color")
        )

        if (!channel?.isTextBased() || !channel.isSendable()) {
            return interaction.reply({
                content: "I cannot send messages in that channel.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (messageType !== "text" && embedColor === null) {
            return interaction.reply({
                content:
                    "Invalid embed color. Use a six-digit hex color like `#5865F2` or `random`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const allowedMentions = { parse: [] }

        if (messageType === "text") {
            await channel.send({
                content: message,
                allowedMentions
            })
        } else {
            const embed = new EmbedBuilder().setColor(embedColor)

            if (messageType === "embed-image") {
                const firstSpace = message.indexOf(" ")
                const imageUrl =
                    firstSpace === -1 ? message : message.slice(0, firstSpace)
                const description =
                    firstSpace === -1 ? "" : message.slice(firstSpace + 1).trim()

                try {
                    const url = new URL(imageUrl)
                    if (!["http:", "https:"].includes(url.protocol)) throw null
                    embed.setImage(url.toString())
                } catch {
                    return interaction.reply({
                        content:
                            "For an image embed, put a valid image URL before the message.",
                        flags: MessageFlags.Ephemeral
                    })
                }

                if (description) embed.setDescription(description)
            } else {
                embed.setDescription(message)
            }

            await channel.send({
                embeds: [embed],
                allowedMentions
            })
        }

        await interaction.reply({
            content: `Message sent to ${channel}.`,
            flags: MessageFlags.Ephemeral
        })
    }
}
