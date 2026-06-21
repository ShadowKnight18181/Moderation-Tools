const fs = require("fs")
const path = require("path")
const crypto = require("crypto")
const { addModCase } = require("../utils/modCases")

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder
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
        .setName("warn")
        .setDescription("Warn a server member")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member to warn")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("reason")
                .setDescription("Reason for the warning")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ModerateMembers)) {
            return interaction.reply({
                content: "You do not have permission to use this command.",
                ephemeral: true
            })
        }

        const member = interaction.options.getMember("member")
        const reason = interaction.options.getString("reason")

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                ephemeral: true
            })
        }

        if (member.id === interaction.user.id) {
            return interaction.reply({
                content: "You cannot warn yourself.",
                ephemeral: true
            })
        }

        if (
            member.id === interaction.guild.ownerId ||
            member.roles.highest.position >= interaction.member.roles.highest.position
        ) {
            return interaction.reply({
                content: "You cannot warn a member with an equal or higher role.",
                ephemeral: true
            })
        }

        const warnings = readWarnings()
        const guildId = interaction.guild.id
        const userId = member.id

        warnings[guildId] ??= {}
        warnings[guildId][userId] ??= []

        const warning = {
            id: crypto.randomUUID().slice(0, 8),
            moderatorId: interaction.user.id,
            reason,
            createdAt: new Date().toISOString()
        }

        warnings[guildId][userId].push(warning)
        saveWarnings(warnings)

        const modCase = addModCase({
            guildId,
            userId,
            moderatorId: interaction.user.id,
            type: "WARN",
            reason,
            details: {
                warningId: warning.id
            }
        })

        const embed = new EmbedBuilder()
            .setColor("#ffb020")
            .setTitle("Member Warned")
            .addFields(
                { name: "Member", value: `${member}`, inline: true },
                { name: "Moderator", value: `${interaction.user}`, inline: true },
                { name: "Reason", value: reason },
                { name: "Warning ID", value: warning.id },
                { name: "Case ID", value: modCase.id }
            )
            .setTimestamp()

        await interaction.reply({ embeds: [embed] })

        setTimeout(async () => {
        await interaction.deleteReply().catch(() => {})
        }, 5_000)

        await member.send({
        content:
        `You were warned in **${interaction.guild.name}**.\n` +
        `Reason: **${reason}**\n` +
        `Warning ID: \`${warning.id}\`\n\n` +
        `Please review the server rules. Contact the moderation team if you believe this was a mistake.`
        }).catch(() => {})

        const logChannel = interaction.guild.channels.cache.get(
            process.env.MOD_LOG_CHANNEL_ID
        )

        if (logChannel?.isTextBased()) {
            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
