const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const {
    addBlockedWords,
    getBlockedWordSettings,
    parseWords,
    removeBlockedWords,
    setBlockedWordsEnabled
} = require("../utils/blockedWords")
const { getLogChannel } = require("../utils/logSettings")

function hiddenWords(words) {
    return words.map(word => `||${word}||`).join(", ")
}

async function sendSettingLog(interaction, enabled) {
    const logChannel = getLogChannel(interaction.guild)
    if (!logChannel) return

    const embed = new EmbedBuilder()
        .setColor(enabled ? "#57f287" : "#ed4245")
        .setTitle(
            enabled
                ? "Blocked-Word Filter Enabled"
                : "Blocked-Word Filter Disabled"
        )
        .addFields({
            name: "Changed by",
            value: `${interaction.user}\n\`${interaction.user.id}\``
        })
        .setTimestamp()

    await logChannel.send({ embeds: [embed] }).catch(console.error)
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("blockedword")
        .setDescription("Manage the server's blocked-word filter")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName("add")
                .setDescription("Add blocked words separated by spaces")
                .addStringOption(option =>
                    option
                        .setName("words")
                        .setDescription("Words to add, separated by spaces")
                        .setMaxLength(1_000)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("remove")
                .setDescription("Remove blocked words separated by spaces")
                .addStringOption(option =>
                    option
                        .setName("words")
                        .setDescription("Words to remove, separated by spaces")
                        .setMaxLength(1_000)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("list")
                .setDescription("List all blocked words")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("enable")
                .setDescription("Enable the blocked-word filter")
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("disable")
                .setDescription("Disable the blocked-word filter")
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    "You need Manage Server permission to configure blocked words.",
                flags: MessageFlags.Ephemeral
            })
        }

        const subcommand = interaction.options.getSubcommand()
        const current = getBlockedWordSettings(interaction.guild.id)

        if (subcommand === "add" || subcommand === "remove") {
            const words = parseWords(
                interaction.options.getString("words")
            )

            if (words.length === 0) {
                return interaction.reply({
                    content: "Provide at least one valid word.",
                    flags: MessageFlags.Ephemeral
                })
            }

            const changed =
                subcommand === "add"
                    ? addBlockedWords(
                          interaction.guild.id,
                          words,
                          interaction.user.id
                      )
                    : removeBlockedWords(
                          interaction.guild.id,
                          words,
                          interaction.user.id
                      )

            return interaction.reply({
                content:
                    changed.length > 0
                        ? `${
                              subcommand === "add" ? "Added" : "Removed"
                          }: ${hiddenWords(changed)}`
                        : subcommand === "add"
                          ? "Those words are already blocked."
                          : "None of those words were blocked.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (subcommand === "list") {
            const settings = getBlockedWordSettings(
                interaction.guild.id
            )

            if (settings.words.length === 0) {
                return interaction.reply({
                    content:
                        `The blocked-word filter is ${
                            settings.enabled ? "enabled" : "disabled"
                        }, but no words are configured.`,
                    flags: MessageFlags.Ephemeral
                })
            }

            const description = settings.words
                .map((word, index) => `${index + 1}. ||${word}||`)
                .join("\n")
                .slice(0, 4_096)

            return interaction.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor("#5865f2")
                        .setTitle("Blocked Words")
                        .setDescription(description)
                        .setFooter({
                            text:
                                `${settings.words.length} word(s) • ` +
                                `${settings.enabled ? "Enabled" : "Disabled"}`
                        })
                        .setTimestamp()
                ],
                flags: MessageFlags.Ephemeral
            })
        }

        const enabled = subcommand === "enable"

        if (current.enabled === enabled) {
            return interaction.reply({
                content: `The blocked-word filter is already ${
                    enabled ? "enabled" : "disabled"
                }.`,
                flags: MessageFlags.Ephemeral
            })
        }

        setBlockedWordsEnabled(
            interaction.guild.id,
            enabled,
            interaction.user.id
        )

        await interaction.reply({
            content: `The blocked-word filter has been ${
                enabled ? "enabled" : "disabled"
            }.`,
            flags: MessageFlags.Ephemeral
        })

        await sendSettingLog(interaction, enabled)
    }
}
