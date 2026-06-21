const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("locked")
        .setDescription("Get a list of locked channels in this server")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const canManageChannels = interaction.memberPermissions.has(
            PermissionFlagsBits.ManageChannels
        )

        if (!isOwner && !canManageChannels) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators with Manage Channels can use `/locked`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const everyoneRoleId = interaction.guild.roles.everyone.id
        const lockedChannels = interaction.guild.channels.cache
            .filter(channel => {
                const overwrite =
                    channel.permissionOverwrites?.cache.get(everyoneRoleId)

                return overwrite?.deny.has(PermissionFlagsBits.SendMessages)
            })
            .sort((first, second) => first.rawPosition - second.rawPosition)

        if (lockedChannels.size === 0) {
            return interaction.reply({
                content: "There are no locked channels in this server.",
                flags: MessageFlags.Ephemeral
            })
        }

        const channelList = lockedChannels
            .map(channel => `• ${channel}`)
            .join("\n")
            .slice(0, 4096)

        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setTitle("Locked Channels")
            .setDescription(channelList)
            .setFooter({
                text: `${lockedChannels.size} locked channel(s)`
            })
            .setTimestamp()

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })
    }
}
