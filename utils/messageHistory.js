const fs = require("fs")
const path = require("path")
const { DatabaseSync } = require("node:sqlite")

const databasePath =
    process.env.DATABASE_PATH ||
    path.join(__dirname, "../data/moderation.db")

fs.mkdirSync(path.dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)

database.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;

    CREATE TABLE IF NOT EXISTS message_history (
        message_id TEXT PRIMARY KEY,
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        attachments TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL
    ) STRICT;

    CREATE INDEX IF NOT EXISTS message_history_lookup
    ON message_history (guild_id, user_id, created_at DESC);
`)

const insertMessage = database.prepare(`
    INSERT OR REPLACE INTO message_history (
        message_id, guild_id, user_id, channel_id,
        content, attachments, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
`)

const countMessages = database.prepare(`
    SELECT COUNT(*) AS total
    FROM message_history
    WHERE guild_id = ? AND user_id = ?
`)

const selectMessages = database.prepare(`
    SELECT
        message_id AS messageId,
        channel_id AS channelId,
        content,
        attachments,
        created_at AS createdAt
    FROM message_history
    WHERE guild_id = ? AND user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
`)

function recordMessage(message) {
    if (!message.guild || message.author.bot) return

    const content = message.content.trim()
    const attachments = [...message.attachments.values()].map(
        attachment => attachment.url
    )

    if (!content && attachments.length === 0) return

    insertMessage.run(
        message.id,
        message.guild.id,
        message.author.id,
        message.channel.id,
        content,
        JSON.stringify(attachments),
        message.createdAt.toISOString()
    )
}

function getMessageHistoryPage(guildId, userId, page = 0, pageSize = 10) {
    const total = Number(countMessages.get(guildId, userId).total)
    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    const currentPage = Math.min(Math.max(0, page), totalPages - 1)
    const messages = selectMessages
        .all(guildId, userId, pageSize, currentPage * pageSize)
        .map(message => ({
            ...message,
            attachments: JSON.parse(message.attachments)
        }))

    return {
        messages,
        total,
        page: currentPage,
        totalPages
    }
}

module.exports = {
    recordMessage,
    getMessageHistoryPage
}
