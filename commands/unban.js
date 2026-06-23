const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { addModCase } = require("../utils/modCases")
const { removeTempBan } = require("../utils/tempBans")
const { getLogChannel } = require("../utils/logSettings")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("unban")
        .setDescription("Unban a user from the server")
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(option =>
            option
                .setName("user-id")
                .setDescription("Discord ID of the user to unban")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the unban")
                .setMaxLength(400)
                .setRequired(false)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(PermissionFlagsBits.BanMembers)
        ) {
            return interaction.reply({
                content: "You do not have permission to unban users.",
                flags: MessageFlags.Ephemeral
            })
        }

        const userId = interaction.options.getString("user-id").trim()
        const reason =
            interaction.options.getString("reason") || "No reason provided"

        if (!/^\d{17,20}$/.test(userId)) {
            return interaction.reply({
                content: "Enter a valid Discord user ID.",
                flags: MessageFlags.Ephemeral
            })
        }

        let ban

        try {
            ban = await interaction.guild.bans.fetch(userId)
        } catch {
            return interaction.reply({
                content: "That user is not currently banned.",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.guild.bans.remove(
            userId,
            `${reason} | Moderator: ${interaction.user.tag}`
        )
        removeTempBan(interaction.guild.id, userId)

        const modCase = addModCase({
            guildId: interaction.guild.id,
            userId,
            moderatorId: interaction.user.id,
            type: "UNBAN",
            reason
        })

        await interaction.reply({
            content: `${ban.user.tag} was unbanned. Case: \`${modCase.id}\``,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("User Unbanned")
                .setThumbnail(ban.user.displayAvatarURL())
                .addFields(
                    {
                        name: "User",
                        value: `${ban.user.tag}\n\`${ban.user.id}\``,
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
                    },
                    {
                        name: "Case ID",
                        value: modCase.id
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
