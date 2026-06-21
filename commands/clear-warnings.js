const fs = require("fs")
const path = require("path")

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")

const warningsPath = path.join(__dirname, "../data/warnings.json")

function readWarnings() {
    return JSON.parse(fs.readFileSync(warningsPath, "utf8"))
}

function saveWarnings(warnings) {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2))
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("clear-warnings")
        .setDescription("Remove all warnings from a member")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member whose warnings should be cleared")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ModerateMembers
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to manage warnings.",
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

        const warnings = readWarnings()
        const guildWarnings = warnings[interaction.guild.id] || {}
        const memberWarnings = guildWarnings[member.id] || []

        if (memberWarnings.length === 0) {
            return interaction.reply({
                content: `${member} has no warnings to clear.`,
                flags: MessageFlags.Ephemeral
            })
        }

        const removedCount = memberWarnings.length

        delete guildWarnings[member.id]

        if (Object.keys(guildWarnings).length === 0) {
            delete warnings[interaction.guild.id]
        }

        saveWarnings(warnings)

        await interaction.reply({
            content: `Cleared ${removedCount} warning(s) from ${member}.`,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("Warnings Cleared")
                .addFields(
                    { name: "Member", value: `${member}`, inline: true },
                    {
                        name: "Cleared by",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Warnings removed",
                        value: `${removedCount}`
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
