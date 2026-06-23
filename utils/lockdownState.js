const fs = require("fs")
const path = require("path")
const { PermissionFlagsBits } = require("discord.js")

const statePath = path.join(__dirname, "../data/lockdowns.json")
const permissionNames = [
    "SendMessages",
    "AddReactions",
    "SendMessagesInThreads",
    "CreatePublicThreads",
    "CreatePrivateThreads"
]

function readStates() {
    try {
        return JSON.parse(fs.readFileSync(statePath, "utf8"))
    } catch {
        return {}
    }
}

function saveStates(states) {
    fs.writeFileSync(statePath, JSON.stringify(states, null, 2))
}

function getLockdownState(guildId) {
    return readStates()[guildId] || null
}

function startLockdown(guildId, startedBy) {
    const states = readStates()
    states[guildId] = {
        active: true,
        startedBy,
        startedAt: new Date().toISOString(),
        channels: {}
    }
    saveStates(states)
    return states[guildId]
}

function getPermissionState(overwrite, permissionName) {
    const permission = PermissionFlagsBits[permissionName]

    if (overwrite?.allow.has(permission)) return "allow"
    if (overwrite?.deny.has(permission)) return "deny"
    return "inherit"
}

function snapshotPermissions(channel, everyoneRoleId) {
    const overwrite =
        channel.permissionOverwrites.cache.get(everyoneRoleId)

    return Object.fromEntries(
        permissionNames.map(permissionName => [
            permissionName,
            getPermissionState(overwrite, permissionName)
        ])
    )
}

function recordLockedChannel(guildId, channel, permissions) {
    const states = readStates()
    const state = states[guildId]
    if (!state?.active) return

    state.channels[channel.id] = {
        name: channel.name,
        permissions
    }
    saveStates(states)
}

function removeLockedChannel(guildId, channelId) {
    const states = readStates()
    const state = states[guildId]
    if (!state) return

    delete state.channels[channelId]

    if (Object.keys(state.channels).length === 0) {
        state.active = false
        state.endedAt = new Date().toISOString()
    }

    saveStates(states)
}

function finishLockdown(guildId, endedBy) {
    const states = readStates()
    const state = states[guildId]
    if (!state) return

    state.active = false
    state.endedBy = endedBy
    state.endedAt = new Date().toISOString()
    state.channels = {}
    saveStates(states)
}

function toOverwriteData(permissions) {
    return Object.fromEntries(
        permissionNames.map(permissionName => {
            const state = permissions[permissionName] || "inherit"
            const value =
                state === "allow"
                    ? true
                    : state === "deny"
                      ? false
                      : null

            return [permissionName, value]
        })
    )
}

module.exports = {
    finishLockdown,
    getLockdownState,
    recordLockedChannel,
    removeLockedChannel,
    snapshotPermissions,
    startLockdown,
    toOverwriteData
}
