const fs = require("fs")
const { getDataPath } = require("./dataStore")

const settingsPath = getDataPath("log-settings.json")

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

function getLogChannelId(guildId) {
    const settings = readSettings()

    if (Object.hasOwn(settings, guildId)) {
        return settings[guildId].channelId || null
    }

    return process.env.MOD_LOG_CHANNEL_ID || null
}

function setLogChannel(guildId, channelId, updatedBy) {
    const settings = readSettings()
    settings[guildId] = {
        channelId,
        updatedBy,
        updatedAt: new Date().toISOString()
    }
    saveSettings(settings)
}

function clearLogChannel(guildId, updatedBy) {
    setLogChannel(guildId, null, updatedBy)
}

function getLogChannel(guild) {
    const channelId = getLogChannelId(guild.id)
    if (!channelId) return null

    const channel = guild.channels.cache.get(channelId)
    return channel?.isTextBased() ? channel : null
}

module.exports = {
    getLogChannelId,
    getLogChannel,
    setLogChannel,
    clearLogChannel
}
