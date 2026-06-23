const {
    SlashCommandBuilder,
    EmbedBuilder
} = require("discord.js")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("avatar")
        .setDescription("View a user's avatar")
        .addUserOption(option =>
            option
                .setName("user")
                .setDescription("User whose avatar you want to view")
                .setRequired(false)
        ),

    async execute(interaction) {
        const user = interaction.options.getUser("user") || interaction.user
        const avatarUrl = user.displayAvatarURL({
            size: 4096,
            extension: user.avatar?.startsWith("a_") ? "gif" : "png",
            forceStatic: false
        })

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setAuthor({
                name: `${user.username}'s avatar`,
                iconURL: user.displayAvatarURL({ size: 128 })
            })
            .setDescription(`[Open avatar](${avatarUrl})`)
            .setImage(avatarUrl)
            .setFooter({ text: `User ID: ${user.id}` })
            .setTimestamp()

        await interaction.reply({ embeds: [embed] })
    }
}
