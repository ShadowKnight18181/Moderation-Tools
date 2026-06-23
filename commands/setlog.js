const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType
} = require("discord.js")
const {
    getLogChannelId,
    setLogChannel,
    clearLogChannel
} = require("../utils/logSettings")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setlog")
        .setDescription("Configure the moderation log channel")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Set the moderation log channel")
                .addChannelOption(option =>
                    option
                        .setName("channel")
                        .setDescription("Channel that should receive logs")
                        .addChannelTypes(
                            ChannelType.GuildText,
                            ChannelType.GuildAnnouncement
                        )
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("clear")
                .setDescription("Disable moderation logging")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("view")
                .setDescription("View the current moderation log channel")
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    "You need Manage Server permission to configure logging.",
                flags: MessageFlags.Ephemeral
            })
        }

        const subcommand = interaction.options.getSubcommand()

        if (subcommand === "set") {
            const channel = interaction.options.getChannel("channel")
            const botMember = interaction.guild.members.me
            const permissions = channel.permissionsFor(botMember)

            if (
                !permissions?.has(PermissionFlagsBits.ViewChannel) ||
                !permissions.has(PermissionFlagsBits.SendMessages) ||
                !permissions.has(PermissionFlagsBits.EmbedLinks)
            ) {
                return interaction.reply({
                    content:
                        "I need View Channel, Send Messages, and Embed Links in that channel.",
                    flags: MessageFlags.Ephemeral
                })
            }

            setLogChannel(
                interaction.guild.id,
                channel.id,
                interaction.user.id
            )

            return interaction.reply({
                content: `Moderation logs will now be sent to ${channel}.`,
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === "clear") {
            clearLogChannel(interaction.guild.id, interaction.user.id)

            return interaction.reply({
                content: "Moderation logging has been disabled.",
                flags: MessageFlags.Ephemeral
            })
        }

        const channelId = getLogChannelId(interaction.guild.id)
        const channel = channelId
            ? interaction.guild.channels.cache.get(channelId)
            : null

        return interaction.reply({
            content: channel
                ? `The moderation log channel is ${channel}.`
                : "No moderation log channel is configured.",
            flags: MessageFlags.Ephemeral
        })
    }
}
