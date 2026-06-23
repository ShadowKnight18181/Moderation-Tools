const actions = new Map()

function getKey(guildId, targetId, action) {
    return `${guildId}:${targetId}:${action}`
}

function recordAction(guildId, targetId, action, user) {
    const key = getKey(guildId, targetId, action)
    const record = {
        userId: user.id,
        userTag: user.tag,
        expiresAt: Date.now() + 15_000
    }

    actions.set(key, record)
    setTimeout(() => {
        if (actions.get(key) === record) actions.delete(key)
    }, 15_000)
}

function consumeAction(guildId, targetId, action) {
    const key = getKey(guildId, targetId, action)
    const record = actions.get(key)

    actions.delete(key)

    if (!record || record.expiresAt < Date.now()) return null
    return record
}

module.exports = {
    recordAction,
    consumeAction
}
