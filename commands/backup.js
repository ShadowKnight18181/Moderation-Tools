const zlib = require("zlib")
const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    AttachmentBuilder,
    MessageFlags
} = require("discord.js")
const { createGuildBackup } = require("../utils/backupData")
const { getLogChannel } = require("../utils/logSettings")
const { EmbedBuilder } = require("discord.js")

function filenameTimestamp() {
    return new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("backup")
        .setDescription("Back up this server's moderation bot data")
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(subcommand =>
            subcommand
                .setName("create")
                .setDescription(
                    "Export this server's moderation data"
                )
        ),

    async execute(interaction) {
        if (interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({
                content:
                    "Only the server owner can create a moderation-data backup.",
                flags: MessageFlags.Ephemeral
            })
        }

        await interaction.deferReply({
            flags: MessageFlags.Ephemeral
        })

        const backup = createGuildBackup(interaction.guild)
        const json = JSON.stringify(backup, null, 2)
        const compressed = zlib.gzipSync(Buffer.from(json, "utf8"), {
            level: zlib.constants.Z_BEST_COMPRESSION
        })
        const filename =
            `moderation-tools-${interaction.guild.id}-` +
            `${filenameTimestamp()}.json.gz`
        const attachment = new AttachmentBuilder(compressed, {
            name: filename,
            description:
                "Current-server moderation data backup"
        })

        await interaction.editReply({
            content:
                "Backup created. Store this file somewhere private—it may contain deleted-message history and moderation records.",
            files: [attachment]
        })

        const logChannel = getLogChannel(interaction.guild)
        if (!logChannel) return

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setTitle("Moderation Data Backup Created")
            .addFields(
                {
                    name: "Created by",
                    value: `${interaction.user}\n\`${interaction.user.id}\``,
                    inline: true
                },
                {
                    name: "Compressed size",
                    value: `${compressed.length.toLocaleString()} bytes`,
                    inline: true
                }
            )
            .setTimestamp()

        await logChannel.send({ embeds: [embed] }).catch(console.error)
    }
}
