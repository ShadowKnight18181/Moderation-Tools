const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const {
    isAntiSpamEnabled,
    messageLimit,
    timeWindow,
    timeoutDuration
} = require("../utils/antiSpam")
const { getAntiJoinSettings } = require("../utils/antiJoin")
const { getLogChannelId } = require("../utils/logSettings")
const { getLockdownState } = require("../utils/lockdownState")
const {
    getBlockedWordSettings
} = require("../utils/blockedWords")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("status")
        .setDescription("View moderation system settings")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageGuild
            )
        ) {
            return interaction.reply({
                content:
                    "You need Manage Server permission to view moderation status.",
                flags: MessageFlags.Ephemeral
            })
        }

        const guildId = interaction.guild.id
        const logChannelId = getLogChannelId(guildId)
        const logChannel = logChannelId
            ? interaction.guild.channels.cache.get(logChannelId)
            : null
        const antiSpamEnabled = isAntiSpamEnabled(guildId)
        const antiJoin = getAntiJoinSettings(guildId)
        const lockdown = getLockdownState(guildId)
        const blockedWords = getBlockedWordSettings(guildId)
        const lockdownChannelCount = lockdown?.active
            ? Object.keys(lockdown.channels || {}).length
            : 0

        let antiJoinValue = "Disabled"
        if (antiJoin) {
            const expiryTimestamp = Math.floor(
                new Date(antiJoin.expiresAt).getTime() / 1000
            )
            const action =
                antiJoin.action === "ban"
                    ? "Temporary ban (24 hours)"
                    : "Kick"

            antiJoinValue =
                `Enabled • ${action}\n` +
                `Expires <t:${expiryTimestamp}:R>`
        }

        let lockdownValue = "Inactive"
        if (lockdown?.active) {
            const startedTimestamp = Math.floor(
                new Date(lockdown.startedAt).getTime() / 1000
            )
            lockdownValue =
                `Active • ${lockdownChannelCount} tracked channel(s)\n` +
                `Started <t:${startedTimestamp}:R>`
        }

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setTitle("Moderation System Status")
            .addFields(
                {
                    name: "Log channel",
                    value: logChannel
                        ? `${logChannel}`
                        : logChannelId
                          ? `Unavailable channel\n\`${logChannelId}\``
                          : "Not configured",
                    inline: true
                },
                {
                    name: "Anti-spam",
                    value: antiSpamEnabled
                        ? `Enabled\n${messageLimit} messages in ${
                              timeWindow / 1_000
                          }s • ${timeoutDuration / 60_000}m timeout`
                        : "Disabled",
                    inline: true
                },
                {
                    name: "Anti-join",
                    value: antiJoinValue,
                    inline: true
                },
                {
                    name: "Lockdown",
                    value: lockdownValue,
                    inline: true
                },
                {
                    name: "Blocked words",
                    value:
                        `${
                            blockedWords.enabled
                                ? "Enabled"
                                : "Disabled"
                        }\n${blockedWords.words.length} configured word(s)`,
                    inline: true
                }
            )
            .setFooter({
                text: `Server ID: ${guildId}`
            })
            .setTimestamp()

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        })
    }
}
