const fs = require("fs")
const path = require("path")
const { exportGuildMessages } = require("./messageHistory")

const dataDirectory = path.join(__dirname, "../data")

function readJsonFile(filename) {
    try {
        return JSON.parse(
            fs.readFileSync(path.join(dataDirectory, filename), "utf8")
        )
    } catch {
        return {}
    }
}

function getGuildValue(filename, guildId) {
    const data = readJsonFile(filename)
    return Object.hasOwn(data, guildId) ? data[guildId] : null
}

function getGuildTempBans(guildId) {
    const tempBans = readJsonFile("temp-bans.json")

    return Object.fromEntries(
        Object.entries(tempBans).filter(
            ([, record]) => record.guildId === guildId
        )
    )
}

function createGuildBackup(guild) {
    const guildId = guild.id

    return {
        format: "moderation-tools-backup",
        version: 1,
        createdAt: new Date().toISOString(),
        guild: {
            id: guildId,
            name: guild.name
        },
        data: {
            moderationCases:
                getGuildValue("mod-cases.json", guildId) || [],
            warnings:
                getGuildValue("warnings.json", guildId) || {},
            temporaryBans: getGuildTempBans(guildId),
            antiSpam: getGuildValue("anti-spam.json", guildId),
            antiJoin: getGuildValue("anti-join.json", guildId),
            blockedWords:
                getGuildValue("blocked-words.json", guildId),
            lockdown: getGuildValue("lockdowns.json", guildId),
            logSettings:
                getGuildValue("log-settings.json", guildId),
            messageHistory: exportGuildMessages(guildId)
        }
    }
}

module.exports = {
    createGuildBackup
}
