const fs = require("fs")
const path = require("path")
const {
    EmbedBuilder,
    Events,
    PermissionFlagsBits
} = require("discord.js")
const { getLogChannel } = require("./logSettings")
const { suppressDeletion } = require("./antiSpam")

const settingsPath = path.join(__dirname, "../data/blocked-words.json")

function readSettings() {
    try {
        return JSON.parse(fs.readFileSync(settingsPath, "utf8"))
    } catch {
        return {}
    }
}

function saveSettings(settings) {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2))
}

function normalizeWord(word) {
    return word.trim().toLocaleLowerCase()
}

function parseWords(input) {
    return [
        ...new Set(
            input
                .split(/\s+/)
                .map(normalizeWord)
                .filter(Boolean)
        )
    ]
}

function getBlockedWordSettings(guildId) {
    const settings = readSettings()
    return {
        enabled: settings[guildId]?.enabled === true,
        words: settings[guildId]?.words || []
    }
}

function setBlockedWordsEnabled(guildId, enabled, updatedBy) {
    const settings = readSettings()
    settings[guildId] ??= { enabled: false, words: [] }
    settings[guildId].enabled = enabled
    settings[guildId].updatedBy = updatedBy
    settings[guildId].updatedAt = new Date().toISOString()
    saveSettings(settings)
}

function addBlockedWords(guildId, words, updatedBy) {
    const settings = readSettings()
    settings[guildId] ??= { enabled: false, words: [] }

    const existing = new Set(settings[guildId].words)
    const added = words.filter(word => !existing.has(word))

    settings[guildId].words = [...existing, ...added].sort()
    settings[guildId].updatedBy = updatedBy
    settings[guildId].updatedAt = new Date().toISOString()
    saveSettings(settings)

    return added
}

function removeBlockedWords(guildId, words, updatedBy) {
    const settings = readSettings()
    settings[guildId] ??= { enabled: false, words: [] }

    const requested = new Set(words)
    const removed = settings[guildId].words.filter(word =>
        requested.has(word)
    )

    settings[guildId].words = settings[guildId].words.filter(
        word => !requested.has(word)
    )
    settings[guildId].updatedBy = updatedBy
    settings[guildId].updatedAt = new Date().toISOString()
    saveSettings(settings)

    return removed
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function findBlockedWord(content, words) {
    const normalizedContent = content.toLocaleLowerCase()

    return words.find(word => {
        const pattern = new RegExp(
            `(^|[^\\p{L}\\p{N}_])${escapeRegExp(word)}` +
                `(?=$|[^\\p{L}\\p{N}_])`,
            "u"
        )

        return pattern.test(normalizedContent)
    })
}

function isProtectedStaff(member) {
    return (
        member.id === member.guild.ownerId ||
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    )
}

function registerBlockedWords(client) {
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot || !message.member) return

        const settings = getBlockedWordSettings(message.guild.id)
        if (!settings.enabled || settings.words.length === 0) return
        if (isProtectedStaff(message.member)) return

        const matchedWord = findBlockedWord(
            message.content,
            settings.words
        )
        if (!matchedWord) return

        suppressDeletion(message.id)
        const deleted = await message
            .delete()
            .then(() => true)
            .catch(() => false)

        const logChannel = getLogChannel(message.guild)
        if (!logChannel) return

        const embed = new EmbedBuilder()
            .setColor(deleted ? "#ed4245" : "#fee75c")
            .setTitle("Blocked Word Detected")
            .setThumbnail(message.author.displayAvatarURL())
            .addFields(
                {
                    name: "Member",
                    value: `${message.author}\n\`${message.author.id}\``,
                    inline: true
                },
                {
                    name: "Channel",
                    value: `${message.channel}`,
                    inline: true
                },
                {
                    name: "Matched word",
                    value: `||${matchedWord}||`
                },
                {
                    name: "Action",
                    value: deleted
                        ? "Message deleted"
                        : "Message could not be deleted"
                }
            )
            .setTimestamp()

        await logChannel.send({ embeds: [embed] }).catch(console.error)
    })
}

module.exports = {
    addBlockedWords,
    getBlockedWordSettings,
    parseWords,
    registerBlockedWords,
    removeBlockedWords,
    setBlockedWordsEnabled
}
