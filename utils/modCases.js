const fs = require("fs")
const crypto = require("crypto")
const { getDataPath } = require("./dataStore")

const casesPath = getDataPath("mod-cases.json")

function readCases() {
    try {
        return JSON.parse(fs.readFileSync(casesPath, "utf8"))
    } catch {
        return {}
    }
}

function saveCases(cases) {
    fs.writeFileSync(casesPath, JSON.stringify(cases, null, 2))
}

function createCaseId(cases) {
    let id

    do {
        id = crypto.randomBytes(4).toString("hex").slice(0, 7)
    } while (
        Object.values(cases).some(guildCases =>
            guildCases.some(modCase => modCase.id === id)
        )
    )

    return id
}

function addModCase({
    guildId,
    userId,
    moderatorId,
    type,
    reason,
    details = {}
}) {
    const cases = readCases()
    cases[guildId] ??= []

    const modCase = {
        id: createCaseId(cases),
        type,
        userId,
        moderatorId,
        reason,
        details,
        createdAt: new Date().toISOString()
    }

    cases[guildId].push(modCase)
    saveCases(cases)

    return modCase
}

function getUserCases(guildId, userId) {
    const cases = readCases()

    return (cases[guildId] || [])
        .filter(modCase => modCase.userId === userId && !modCase.deletedAt)
        .sort(
            (first, second) =>
                new Date(second.createdAt) - new Date(first.createdAt)
        )
}

function getModCase(guildId, caseId) {
    const cases = readCases()

    return (cases[guildId] || []).find(
        modCase =>
            modCase.id.toLowerCase() === caseId.toLowerCase() &&
            !modCase.deletedAt
    )
}

function getGuildCases(guildId) {
    const cases = readCases()

    return (cases[guildId] || [])
        .filter(modCase => !modCase.deletedAt)
        .sort(
            (first, second) =>
                new Date(second.createdAt) - new Date(first.createdAt)
        )
}

function closeModCase(guildId, caseId, closedBy, closeReason) {
    const cases = readCases()
    const modCase = (cases[guildId] || []).find(
        entry => entry.id.toLowerCase() === caseId.toLowerCase()
    )

    if (!modCase) return null
    if (modCase.closedAt) return { modCase, alreadyClosed: true }

    modCase.closedAt = new Date().toISOString()
    modCase.closedBy = closedBy
    modCase.closeReason = closeReason || "No closing reason provided"
    saveCases(cases)

    return { modCase, alreadyClosed: false }
}

function deleteModCase(guildId, caseId, deletedBy, deleteReason) {
    const cases = readCases()
    const modCase = (cases[guildId] || []).find(
        entry =>
            entry.id.toLowerCase() === caseId.toLowerCase() &&
            !entry.deletedAt
    )

    if (!modCase) return null

    modCase.deletedAt = new Date().toISOString()
    modCase.deletedBy = deletedBy
    modCase.deleteReason = deleteReason || "No deletion reason provided"
    saveCases(cases)

    return modCase
}

module.exports = {
    addModCase,
    getUserCases,
    getModCase,
    getGuildCases,
    closeModCase,
    deleteModCase
}
