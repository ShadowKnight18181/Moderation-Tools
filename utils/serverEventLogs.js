const {
    EmbedBuilder,
    Events,
    AuditLogEvent,
    PermissionFlagsBits
} = require("discord.js")
const {
    recordMessage,
    getStoredMessage
} = require("./messageHistory")
const { consumeSuppressedDeletion } = require("./antiSpam")
const { getLogChannel } = require("./logSettings")
const { consumeAction } = require("./actionAttribution")

function truncate(value, maximum = 1024) {
    if (!value) return "None"
    if (value.length <= maximum) return value
    return `${value.slice(0, maximum - 1)}…`
}

function formatContent(content) {
    if (!content) return "*No text content*"
    return truncate(content, 1024)
}

function formatAttachments(attachments) {
    if (!attachments?.length) return null
    return truncate(attachments.join("\n"), 1024)
}

function getMessageSnapshot(message) {
    if (!message) return null

    const stored = getStoredMessage(message.id)
    const attachments = message.attachments?.size
        ? [...message.attachments.values()].map(attachment => attachment.url)
        : stored?.attachments || []

    return {
        guildId: message.guildId || stored?.guildId,
        userId: message.author?.id || stored?.userId,
        channelId: message.channelId || stored?.channelId,
        content:
            typeof message.content === "string"
                ? message.content
                : stored?.content || "",
        attachments,
        author: message.author || null
    }
}

async function sendLog(guild, embed) {
    const logChannel = getLogChannel(guild)
    if (!logChannel) return
    await logChannel.send({ embeds: [embed] }).catch(console.error)
}

async function getAuditExecutor(guild, type, targetId) {
    const botMember = guild.members.me
    if (
        !botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog)
    ) {
        return null
    }

    await new Promise(resolve => setTimeout(resolve, 750))

    const auditLogs = await guild
        .fetchAuditLogs({ type, limit: 6 })
        .catch(() => null)
    if (!auditLogs) return null

    const entry = auditLogs.entries.find(
        log =>
            log.target?.id === targetId &&
            Date.now() - log.createdTimestamp < 10_000
    )

    return entry?.executor || null
}

async function getMessageDeleteExecutor(guild, userId, channelId) {
    const botMember = guild.members.me
    if (
        !botMember?.permissions.has(PermissionFlagsBits.ViewAuditLog)
    ) {
        return null
    }

    await new Promise(resolve => setTimeout(resolve, 1_000))

    const auditLogs = await guild
        .fetchAuditLogs({
            type: AuditLogEvent.MessageDelete,
            limit: 8
        })
        .catch(() => null)
    if (!auditLogs) return null

    const entry = auditLogs.entries.find(log => {
        const auditChannelId =
            log.extra?.channel?.id ||
            log.extra?.channelId

        return (
            log.target?.id === userId &&
            auditChannelId === channelId &&
            Date.now() - log.createdTimestamp < 15_000
        )
    })

    return entry?.executor || null
}

function formatPermissions(permissions) {
    const names = permissions.toArray()
    if (!names.length) return "None"
    return truncate(names.join(", "), 1024)
}

function registerServerEventLogs(client) {
    client.on(Events.MessageDelete, async message => {
        if (consumeSuppressedDeletion(message.id)) return

        const snapshot = getMessageSnapshot(message)
        if (!snapshot?.guildId) return
        if (!snapshot.author && !snapshot.userId) return

        const guild = message.guild || client.guilds.cache.get(snapshot.guildId)
        if (!guild) return

        const user =
            snapshot.author ||
            (snapshot.userId
                ? await client.users.fetch(snapshot.userId).catch(() => null)
                : null)
        if (user?.bot) return

        const authorValue = user
            ? `${user}\n\`${user.id}\``
            : snapshot.userId
              ? `Unknown user\n\`${snapshot.userId}\``
              : "Unavailable (message was not cached)"
        const contentValue =
            snapshot.content || snapshot.attachments.length
                ? formatContent(snapshot.content)
                : "*Unavailable — this message was not cached before deletion*"

        const deleteExecutor = snapshot.userId
            ? await getMessageDeleteExecutor(
                  guild,
                  snapshot.userId,
                  snapshot.channelId
              )
            : null
        const deletedByValue = deleteExecutor
            ? `${deleteExecutor}\n\`${deleteExecutor.id}\``
            : "Likely the author, or unavailable"

        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setTitle("Message Deleted")
            .addFields(
                {
                    name: "Author",
                    value: authorValue,
                    inline: true
                },
                {
                    name: "Channel",
                    value: `<#${snapshot.channelId}>`,
                    inline: true
                },
                {
                    name: "Deleted by",
                    value: deletedByValue,
                    inline: true
                },
                {
                    name: "Content",
                    value: contentValue
                }
            )
            .setFooter({ text: `Message ID: ${message.id}` })
            .setTimestamp()

        const attachmentText = formatAttachments(snapshot.attachments)
        if (attachmentText) {
            embed.addFields({
                name: "Attachments",
                value: attachmentText
            })
        }

        if (user) {
            embed.setThumbnail(user.displayAvatarURL())
        }

        await sendLog(guild, embed)
    })

    client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
        const before = getMessageSnapshot(oldMessage)
        let currentMessage = newMessage

        if (currentMessage.partial) {
            currentMessage = await currentMessage.fetch().catch(() => null)
        }
        if (!currentMessage?.guild) return

        const author =
            currentMessage.author ||
            oldMessage.author ||
            (await client.users.fetch(before?.userId).catch(() => null))
        if (!author || author.bot) return

        const afterContent = currentMessage.content || ""
        const beforeContent = before?.content || ""
        const afterAttachments = [...currentMessage.attachments.values()].map(
            attachment => attachment.url
        )
        const beforeAttachments = before?.attachments || []

        const contentChanged = beforeContent !== afterContent
        const attachmentsChanged =
            JSON.stringify(beforeAttachments) !==
            JSON.stringify(afterAttachments)

        if (!contentChanged && !attachmentsChanged) return

        recordMessage(currentMessage)

        const messageUrl =
            `https://discord.com/channels/${currentMessage.guild.id}/` +
            `${currentMessage.channel.id}/${currentMessage.id}`
        const embed = new EmbedBuilder()
            .setColor("#fee75c")
            .setTitle("Message Edited")
            .setDescription(`[Jump to message](${messageUrl})`)
            .addFields(
                {
                    name: "Author",
                    value: `${author}\n\`${author.id}\``,
                    inline: true
                },
                {
                    name: "Channel",
                    value: `${currentMessage.channel}`,
                    inline: true
                },
                {
                    name: "Before",
                    value: formatContent(beforeContent)
                },
                {
                    name: "After",
                    value: formatContent(afterContent)
                }
            )
            .setThumbnail(author.displayAvatarURL())
            .setFooter({ text: `Message ID: ${currentMessage.id}` })
            .setTimestamp()

        if (attachmentsChanged) {
            embed.addFields(
                {
                    name: "Attachments before",
                    value: formatAttachments(beforeAttachments) || "None"
                },
                {
                    name: "Attachments after",
                    value: formatAttachments(afterAttachments) || "None"
                }
            )
        }

        await sendLog(currentMessage.guild, embed)
    })

    client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
        const nicknameChanged = oldMember.nickname !== newMember.nickname
        const addedRoles = newMember.roles.cache.filter(
            role =>
                role.id !== newMember.guild.roles.everyone.id &&
                !oldMember.roles.cache.has(role.id)
        )
        const removedRoles = oldMember.roles.cache.filter(
            role =>
                role.id !== newMember.guild.roles.everyone.id &&
                !newMember.roles.cache.has(role.id)
        )

        if (!nicknameChanged && !addedRoles.size && !removedRoles.size) return

        const commandActor = nicknameChanged
            ? consumeAction(
                  newMember.guild.id,
                  newMember.id,
                  "nickname"
              )
            : null
        const auditType =
            addedRoles.size || removedRoles.size
                ? AuditLogEvent.MemberRoleUpdate
                : AuditLogEvent.MemberUpdate
        const executor = await getAuditExecutor(
            newMember.guild,
            auditType,
            newMember.id
        )
        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setTitle("Member Updated")
            .setThumbnail(newMember.user.displayAvatarURL())
            .addFields(
                {
                    name: "Member",
                    value: `${newMember}\n\`${newMember.id}\``,
                    inline: true
                },
                {
                    name: commandActor
                        ? "Command used by"
                        : "Changed by",
                    value: commandActor
                        ? `<@${commandActor.userId}>\n` +
                          `\`${commandActor.userId}\``
                        : executor
                          ? `${executor}\n\`${executor.id}\``
                          : "Unavailable",
                    inline: true
                }
            )
            .setTimestamp()

        if (
            commandActor &&
            executor &&
            executor.id !== commandActor.userId
        ) {
            embed.addFields({
                name: "Applied by",
                value: `${executor}\n\`${executor.id}\``,
                inline: true
            })
        }

        if (nicknameChanged) {
            embed.addFields(
                {
                    name: "Nickname before",
                    value: truncate(oldMember.nickname || "None")
                },
                {
                    name: "Nickname after",
                    value: truncate(newMember.nickname || "None")
                }
            )
        }

        if (addedRoles.size) {
            embed.addFields({
                name: "Roles added",
                value: truncate(addedRoles.map(role => `${role}`).join("\n"))
            })
        }

        if (removedRoles.size) {
            embed.addFields({
                name: "Roles removed",
                value: truncate(removedRoles.map(role => `${role}`).join("\n"))
            })
        }

        await sendLog(newMember.guild, embed)
    })

    client.on(Events.GuildRoleCreate, async role => {
        if (role.managed) return

        const executor = await getAuditExecutor(
            role.guild,
            AuditLogEvent.RoleCreate,
            role.id
        )
        const embed = new EmbedBuilder()
            .setColor("#57f287")
            .setTitle("Role Created")
            .addFields(
                {
                    name: "Role",
                    value: `${role}\n\`${role.id}\``,
                    inline: true
                },
                {
                    name: "Created by",
                    value: executor
                        ? `${executor}\n\`${executor.id}\``
                        : "Unavailable",
                    inline: true
                },
                {
                    name: "Color",
                    value: role.hexColor,
                    inline: true
                },
                {
                    name: "Permissions",
                    value: formatPermissions(role.permissions)
                }
            )
            .setTimestamp()

        await sendLog(role.guild, embed)
    })

    client.on(Events.GuildRoleDelete, async role => {
        if (role.managed) return

        const executor = await getAuditExecutor(
            role.guild,
            AuditLogEvent.RoleDelete,
            role.id
        )
        const embed = new EmbedBuilder()
            .setColor("#ed4245")
            .setTitle("Role Deleted")
            .addFields(
                {
                    name: "Role",
                    value: `${role.name}\n\`${role.id}\``,
                    inline: true
                },
                {
                    name: "Deleted by",
                    value: executor
                        ? `${executor}\n\`${executor.id}\``
                        : "Unavailable",
                    inline: true
                },
                {
                    name: "Color",
                    value: role.hexColor,
                    inline: true
                },
                {
                    name: "Permissions",
                    value: formatPermissions(role.permissions)
                }
            )
            .setTimestamp()

        await sendLog(role.guild, embed)
    })

    client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
        if (newRole.managed) return

        const changes = []

        if (oldRole.name !== newRole.name) {
            changes.push({
                name: "Name",
                value: `${oldRole.name} → ${newRole.name}`
            })
        }

        if (oldRole.color !== newRole.color) {
            changes.push({
                name: "Color",
                value: `${oldRole.hexColor} → ${newRole.hexColor}`
            })
        }

        if (oldRole.hoist !== newRole.hoist) {
            changes.push({
                name: "Displayed separately",
                value: `${oldRole.hoist ? "Yes" : "No"} → ${
                    newRole.hoist ? "Yes" : "No"
                }`
            })
        }

        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push({
                name: "Mentionable",
                value: `${oldRole.mentionable ? "Yes" : "No"} → ${
                    newRole.mentionable ? "Yes" : "No"
                }`
            })
        }

        if (!oldRole.permissions.equals(newRole.permissions)) {
            const added = newRole.permissions
                .toArray()
                .filter(permission => !oldRole.permissions.has(permission))
            const removed = oldRole.permissions
                .toArray()
                .filter(permission => !newRole.permissions.has(permission))

            changes.push({
                name: "Permission changes",
                value: truncate(
                    [
                        added.length
                            ? `Added: ${added.join(", ")}`
                            : null,
                        removed.length
                            ? `Removed: ${removed.join(", ")}`
                            : null
                    ]
                        .filter(Boolean)
                        .join("\n")
                )
            })
        }

        if (!changes.length) return

        const executor = await getAuditExecutor(
            newRole.guild,
            AuditLogEvent.RoleUpdate,
            newRole.id
        )
        const embed = new EmbedBuilder()
            .setColor("#fee75c")
            .setTitle("Role Updated")
            .addFields(
                {
                    name: "Role",
                    value: `${newRole}\n\`${newRole.id}\``,
                    inline: true
                },
                {
                    name: "Updated by",
                    value: executor
                        ? `${executor}\n\`${executor.id}\``
                        : "Unavailable",
                    inline: true
                },
                ...changes
            )
            .setTimestamp()

        await sendLog(newRole.guild, embed)
    })
}

module.exports = {
    registerServerEventLogs
}
