const fs = require("fs")
const { getDataPath } = require("../utils/dataStore")

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")

const warningsPath = getDataPath("warnings.json")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("warnings")
        .setDescription("View a member's warning history")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member whose warnings you want to view")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ModerateMembers
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to view warnings.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("member")

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                flags: MessageFlags.Ephemeral
            })
        }

        const warnings = JSON.parse(
            fs.readFileSync(warningsPath, "utf8")
        )

        const memberWarnings =
            warnings[interaction.guild.id]?.[member.id] || []

        if (memberWarnings.length === 0) {
            return interaction.reply({
                content: `${member} has no warnings.`,
                flags: MessageFlags.Ephemeral
            })
        }

        const description = memberWarnings
            .map((warning, index) => {
                const timestamp = Math.floor(
                    new Date(warning.createdAt).getTime() / 1000
                )

                return [
                    `**${index + 1}. Warning \`${warning.id}\`**`,
                    `Reason: ${warning.reason}`,
                    `Moderator: <@${warning.moderatorId}>`,
                    `Date: <t:${timestamp}:f>`
                ].join("\n")
            })
            .join("\n\n")

        const embed = new EmbedBuilder()
            .setColor("#ffb020")
            .setTitle(`Warnings for ${member.user.username}`)
            .setDescription(description)
            .setFooter({
                text: `${memberWarnings.length} warning(s)`
            })

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })
    }
}
