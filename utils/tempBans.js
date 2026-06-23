const fs = require("fs")
const { getDataPath } = require("./dataStore")

const tempBansPath = getDataPath("temp-bans.json")
const maximumTimer = 2_147_000_000
const timers = new Map()

function readTempBans() {
    try {
        return JSON.parse(fs.readFileSync(tempBansPath, "utf8"))
    } catch {
        return {}
    }
}

function saveTempBans(tempBans) {
    fs.writeFileSync(tempBansPath, JSON.stringify(tempBans, null, 2))
}

function getKey(guildId, userId) {
    return `${guildId}:${userId}`
}

function clearTempBanTimer(guildId, userId) {
    const key = getKey(guildId, userId)
    const timer = timers.get(key)

    if (timer) clearTimeout(timer)
    timers.delete(key)
}

function removeTempBan(guildId, userId) {
    clearTempBanTimer(guildId, userId)

    const tempBans = readTempBans()
    const key = getKey(guildId, userId)

    if (!tempBans[key]) return false

    delete tempBans[key]
    saveTempBans(tempBans)
    return true
}

async function expireTempBan(client, record) {
    try {
        const guild = await client.guilds.fetch(record.guildId)
        await guild.bans.remove(record.userId, "Temporary ban expired")
    } catch (error) {
        if (error?.code !== 10026) {
            console.error("Failed to expire temporary ban:", error)
        }
    } finally {
        removeTempBan(record.guildId, record.userId)
    }
}

function scheduleRecord(client, record) {
    const key = getKey(record.guildId, record.userId)
    clearTempBanTimer(record.guildId, record.userId)

    const scheduleNext = () => {
        const remaining = new Date(record.expiresAt).getTime() - Date.now()

        if (remaining <= 0) {
            void expireTempBan(client, record)
            return
        }

        const timer = setTimeout(
            scheduleNext,
            Math.min(remaining, maximumTimer)
        )
        timers.set(key, timer)
    }

    scheduleNext()
}

function addTempBan(client, record) {
    const tempBans = readTempBans()
    tempBans[getKey(record.guildId, record.userId)] = record
    saveTempBans(tempBans)
    scheduleRecord(client, record)
}

function restoreTempBans(client) {
    for (const record of Object.values(readTempBans())) {
        scheduleRecord(client, record)
    }
}

module.exports = {
    addTempBan,
    removeTempBan,
    restoreTempBans
}
