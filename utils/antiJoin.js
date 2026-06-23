const fs = require("fs")
const path = require("path")
const {
    EmbedBuilder,
    Events
} = require("discord.js")
const { addModCase } = require("./modCases")
const { addTempBan } = require("./tempBans")
const { getLogChannel } = require("./logSettings")

const settingsPath = path.join(__dirname, "../data/anti-join.json")
const timers = new Map()
const maximumDuration = 24 * 60 * 60_000
const temporaryBanDuration = 24 * 60 * 60_000

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

function parseDuration(input) {
    const match = input.trim().toLowerCase().match(/^(\d+)(m|h)$/)
    if (!match) return null

    const amount = Number(match[1])
    const multiplier = match[2] === "m" ? 60_000 : 60 * 60_000
    const duration = amount * multiplier

    if (amount < 1 || duration > maximumDuration) return null
    return duration
}

function clearExpiryTimer(guildId) {
    const timer = timers.get(guildId)
    if (timer) clearTimeout(timer)
    timers.delete(guildId)
}

function getAntiJoinSettings(guildId) {
    const settings = readSettings()[guildId]
    if (!settings?.enabled) return null

    if (new Date(settings.expiresAt).getTime() <= Date.now()) {
        disableAntiJoin(guildId)
        return null
    }

    return settings
}

function disableAntiJoin(guildId, disabledBy = null) {
    clearExpiryTimer(guildId)

    const allSettings = readSettings()
    const previous = allSettings[guildId]

    allSettings[guildId] = {
        ...(previous || {}),
        enabled: false,
        disabledBy,
        disabledAt: new Date().toISOString()
    }
    saveSettings(allSettings)

    return previous || null
}

async function sendExpiryLog(client, guildId) {
    const guild = client.guilds.cache.get(guildId)
    if (!guild) return

    const logChannel = getLogChannel(guild)
    if (!logChannel) return

    const embed = new EmbedBuilder()
        .setColor("#57f287")
        .setTitle("Anti-Join Expired")
        .setDescription(
            "Emergency anti-join protection was automatically disabled."
        )
        .setTimestamp()

    await logChannel.send({ embeds: [embed] }).catch(console.error)
}

function scheduleExpiry(client, guildId, expiresAt) {
    clearExpiryTimer(guildId)

    const remaining = new Date(expiresAt).getTime() - Date.now()
    if (remaining <= 0) {
        disableAntiJoin(guildId)
        return
    }

    const timer = setTimeout(async () => {
        disableAntiJoin(guildId)
        await sendExpiryLog(client, guildId)
    }, remaining)

    timers.set(guildId, timer)
}

function enableAntiJoin(
    client,
    guildId,
    { duration, durationName, action, enabledBy }
) {
    const allSettings = readSettings()
    const expiresAt = new Date(Date.now() + duration).toISOString()
    const settings = {
        enabled: true,
        action,
        duration: durationName,
        enabledBy,
        enabledAt: new Date().toISOString(),
        expiresAt
    }

    allSettings[guildId] = settings
    saveSettings(allSettings)
    scheduleExpiry(client, guildId, expiresAt)

    return settings
}

function restoreAntiJoin(client) {
    const allSettings = readSettings()

    for (const [guildId, settings] of Object.entries(allSettings)) {
        if (!settings.enabled) continue

        if (new Date(settings.expiresAt).getTime() <= Date.now()) {
            disableAntiJoin(guildId)
            continue
        }

        scheduleExpiry(client, guildId, settings.expiresAt)
    }
}

async function logBlockedJoin(member, settings, actionSucceeded) {
    const logChannel = getLogChannel(member.guild)
    if (!logChannel) return

    const embed = new EmbedBuilder()
        .setColor(actionSucceeded ? "#ed4245" : "#fee75c")
        .setTitle("Member Blocked by Anti-Join")
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            {
                name: "Member",
                value: `${member.user.tag}\n\`${member.id}\``,
                inline: true
            },
            {
                name: "Action",
                value:
                    settings.action === "ban"
                        ? "Temporary ban (24 hours)"
                        : "Kick",
                inline: true
            },
            {
                name: "Result",
                value: actionSucceeded ? "Successful" : "Failed"
            }
        )
        .setTimestamp()

    await logChannel.send({ embeds: [embed] }).catch(console.error)
}

function registerAntiJoin(client) {
    client.on(Events.GuildMemberAdd, async member => {
        const settings = getAntiJoinSettings(member.guild.id)
        if (!settings || member.user.bot) return

        const reason = "Emergency anti-join protection is enabled"
        let actionSucceeded = false

        try {
            if (settings.action === "ban") {
                await member.ban({
                    reason: `${reason} | Enabled by ${settings.enabledBy}`
                })
                actionSucceeded = true

                const expiresAt = new Date(
                    Date.now() + temporaryBanDuration
                ).toISOString()
                const modCase = addModCase({
                    guildId: member.guild.id,
                    userId: member.id,
                    moderatorId: client.user.id,
                    type: "TEMPBAN",
                    reason,
                    details: {
                        duration: "24h",
                        expiresAt,
                        source: "anti-join"
                    }
                })

                addTempBan(client, {
                    guildId: member.guild.id,
                    userId: member.id,
                    expiresAt,
                    caseId: modCase.id
                })
            } else {
                await member.kick(
                    `${reason} | Enabled by ${settings.enabledBy}`
                )
                actionSucceeded = true

                addModCase({
                    guildId: member.guild.id,
                    userId: member.id,
                    moderatorId: client.user.id,
                    type: "KICK",
                    reason,
                    details: {
                        source: "anti-join"
                    }
                })
            }
        } catch (error) {
            console.error(
                `Failed to apply anti-join to ${member.user.tag}:`,
                error
            )
        }

        await logBlockedJoin(member, settings, actionSucceeded)
    })
}

module.exports = {
    enableAntiJoin,
    disableAntiJoin,
    getAntiJoinSettings,
    parseDuration,
    registerAntiJoin,
    restoreAntiJoin,
    maximumDuration
}
