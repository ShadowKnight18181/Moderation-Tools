const fs = require("fs")
const { getDataPath } = require("./dataStore")

const warningsPath = getDataPath("warnings.json")

function readWarnings() {
    try {
        return JSON.parse(fs.readFileSync(warningsPath, "utf8"))
    } catch {
        return {}
    }
}

function isWarningActive(guildId, modCase) {
    if (modCase.type !== "WARN") return null

    const warnings = readWarnings()
    const memberWarnings = warnings[guildId]?.[modCase.userId] || []

    if (modCase.details?.warningId) {
        return memberWarnings.some(
            warning =>
                warning.id.toLowerCase() ===
                modCase.details.warningId.toLowerCase()
        )
    }

    return memberWarnings.some(warning => {
        const timeDifference = Math.abs(
            new Date(warning.createdAt).getTime() -
                new Date(modCase.createdAt).getTime()
        )

        return (
            warning.moderatorId === modCase.moderatorId &&
            warning.reason === modCase.reason &&
            timeDifference <= 5_000
        )
    })
}

module.exports = {
    isWarningActive
}
