const fs = require("fs")
const path = require("path")
const {
    EmbedBuilder,
    Events,
    PermissionFlagsBits
} = require("discord.js")
const { addModCase } = require("./modCases")
const { getLogChannel } = require("./logSettings")

const settingsPath = path.join(__dirname, "../data/anti-spam.json")
const messageLimit = 8
const timeWindow = 6_000
const timeoutDuration = 5 * 60_000
const punishmentCooldown = 30_000
const messageBuckets = new Map()
const cooldowns = new Map()
const suppressedDeletions = new Set()

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

function isAntiSpamEnabled(guildId) {
    return readSettings()[guildId]?.enabled === true
}

function setAntiSpamEnabled(guildId, enabled, updatedBy) {
    const settings = readSettings()

    settings[guildId] = {
        enabled,
        updatedBy,
        updatedAt: new Date().toISOString()
    }

    saveSettings(settings)
    return settings[guildId]
}

function isProtectedStaff(member) {
    return (
        member.id === member.guild.ownerId ||
        member.permissions.has(PermissionFlagsBits.Administrator) ||
        member.permissions.has(PermissionFlagsBits.ManageMessages) ||
        member.permissions.has(PermissionFlagsBits.ModerateMembers)
    )
}

function suppressDeletion(messageId) {
    suppressedDeletions.add(messageId)
    setTimeout(() => suppressedDeletions.delete(messageId), 30_000)
}

function consumeSuppressedDeletion(messageId) {
    if (!suppressedDeletions.has(messageId)) return false
    suppressedDeletions.delete(messageId)
    return true
}

async function sendDetectionLog(
    message,
    messages,
    protectedStaff,
    modCase,
    timedOut = false
) {
    const logChannel = getLogChannel(message.guild)
    if (!logChannel) return

    const embed = new EmbedBuilder()
        .setColor(protectedStaff ? "#fee75c" : "#ed4245")
        .setTitle(
            protectedStaff
                ? "Staff Spam Detected"
                : "Anti-Spam Action"
        )
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
                name: "Messages",
                value:
                    `${messages.length} messages within ` +
                    `${timeWindow / 1_000} seconds`
            },
            {
                name: "Action",
                value: protectedStaff
                    ? "Logged only — staff are exempt from automatic punishment."
                    : timedOut
                      ? "Spam messages deleted and member timed out for 5 minutes."
                      : "Spam messages deleted, but the timeout could not be applied."
            }
        )
        .setTimestamp()

    if (modCase) {
        embed.addFields({
            name: "Case ID",
            value: modCase.id
        })
    }

    await logChannel.send({ embeds: [embed] }).catch(console.error)
}

function registerAntiSpam(client) {
    client.on(Events.MessageCreate, async message => {
        if (!message.guild || message.author.bot) return
        if (!isAntiSpamEnabled(message.guild.id)) return

        const member = message.member
        if (!member) return

        const key = `${message.guild.id}:${message.author.id}`
        const now = Date.now()
        const cooldownUntil = cooldowns.get(key) || 0

        if (cooldownUntil > now) return

        const recentMessages = (messageBuckets.get(key) || [])
            .filter(entry => now - entry.createdAt <= timeWindow)

        recentMessages.push({
            id: message.id,
            message,
            createdAt: now
        })
        messageBuckets.set(key, recentMessages)

        if (recentMessages.length < messageLimit) return

        messageBuckets.delete(key)
        cooldowns.set(key, now + punishmentCooldown)
        setTimeout(() => cooldowns.delete(key), punishmentCooldown)

        const protectedStaff = isProtectedStaff(member)

        if (protectedStaff) {
            await sendDetectionLog(
                message,
                recentMessages,
                true,
                null
            )
            return
        }

        let timedOut = false
        if (member.moderatable) {
            await member
                .timeout(timeoutDuration, "Anti-spam: 8 messages in 6 seconds")
                .then(() => {
                    timedOut = true
                })
                .catch(console.error)
        }

        const messagesToDelete = recentMessages.map(entry => entry.message)
        messagesToDelete.forEach(spamMessage =>
            suppressDeletion(spamMessage.id)
        )
        await Promise.allSettled(
            messagesToDelete.map(spamMessage => spamMessage.delete())
        )

        const modCase = addModCase({
            guildId: message.guild.id,
            userId: member.id,
            moderatorId: client.user.id,
            type: "MUTE",
            reason: "Automatic anti-spam action",
            details: {
                duration: timedOut ? "5m" : "Timeout failed",
                messageCount: recentMessages.length,
                timeWindow: "6s"
            }
        })

        await sendDetectionLog(
            message,
            recentMessages,
            false,
            modCase,
            timedOut
        )
    })
}

module.exports = {
    isAntiSpamEnabled,
    setAntiSpamEnabled,
    registerAntiSpam,
    suppressDeletion,
    consumeSuppressedDeletion,
    messageLimit,
    timeWindow,
    timeoutDuration
}
