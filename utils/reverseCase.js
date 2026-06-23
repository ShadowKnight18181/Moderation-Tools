const fs = require("fs")
const { PermissionFlagsBits } = require("discord.js")
const { getDataPath } = require("./dataStore")

const warningsPath = getDataPath("warnings.json")

function readWarnings() {
    try {
        return JSON.parse(fs.readFileSync(warningsPath, "utf8"))
    } catch {
        return {}
    }
}

function saveWarnings(warnings) {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2))
}

function findWarningIndex(warnings, guildId, modCase) {
    const memberWarnings = warnings[guildId]?.[modCase.userId] || []

    if (modCase.details?.warningId) {
        return memberWarnings.findIndex(
            warning =>
                warning.id.toLowerCase() ===
                modCase.details.warningId.toLowerCase()
        )
    }

    return memberWarnings.findIndex(warning => {
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

async function reverseModCase(interaction, modCase, reason) {
    if (modCase.type === "WARN") {
        const warnings = readWarnings()
        const memberWarnings =
            warnings[interaction.guild.id]?.[modCase.userId] || []
        const warningIndex = findWarningIndex(
            warnings,
            interaction.guild.id,
            modCase
        )

        if (warningIndex === -1) {
            return {
                success: true,
                message: "The warning had already been removed."
            }
        }

        memberWarnings.splice(warningIndex, 1)

        if (memberWarnings.length === 0) {
            delete warnings[interaction.guild.id][modCase.userId]
        }

        saveWarnings(warnings)
        return { success: true, message: "The warning was removed." }
    }

    if (modCase.type === "BAN") {
        const ban = await interaction.guild.bans
            .fetch(modCase.userId)
            .catch(() => null)

        if (!ban) {
            return {
                success: true,
                message: "The user was already unbanned."
            }
        }

        await interaction.guild.bans.remove(
            modCase.userId,
            `${reason} | Case deleted by ${interaction.user.tag}`
        )
        return { success: true, message: "The user was unbanned." }
    }

    if (modCase.type === "MUTE") {
        const member = await interaction.guild.members
            .fetch(modCase.userId)
            .catch(() => null)

        if (!member) {
            return {
                success: false,
                message:
                    "The member is not currently in the server, so the timeout cannot be removed."
            }
        }

        if (!member.isCommunicationDisabled()) {
            return {
                success: true,
                message: "The member was already unmuted."
            }
        }

        if (!member.moderatable) {
            return {
                success: false,
                message:
                    "I cannot remove this timeout because of role hierarchy or missing permissions."
            }
        }

        await member.timeout(
            null,
            `${reason} | Case deleted by ${interaction.user.tag}`
        )
        return { success: true, message: "The timeout was removed." }
    }

    if (modCase.type === "ROLE REMOVE") {
        const member = await interaction.guild.members
            .fetch(modCase.userId)
            .catch(() => null)
        const role = modCase.details?.roleId
            ? await interaction.guild.roles
                  .fetch(modCase.details.roleId)
                  .catch(() => null)
            : null
        const botMember = interaction.guild.members.me

        if (!member) {
            return {
                success: false,
                message:
                    "The member is not currently in the server, so the role cannot be restored."
            }
        }

        if (!role) {
            return {
                success: false,
                message:
                    "The removed role no longer exists, so it cannot be restored."
            }
        }

        if (member.roles.cache.has(role.id)) {
            return {
                success: true,
                message: "The member already has the role."
            }
        }

        if (
            role.managed ||
            !botMember?.permissions.has(PermissionFlagsBits.ManageRoles) ||
            role.position >= botMember.roles.highest.position
        ) {
            return {
                success: false,
                message:
                    "I cannot restore that role because of role hierarchy or missing permissions."
            }
        }

        await member.roles.add(
            role,
            `${reason} | Case deleted by ${interaction.user.tag}`
        )
        return { success: true, message: "The removed role was restored." }
    }

    if (modCase.type === "KICK") {
        return {
            success: false,
            message:
                "A kick cannot be reversed because the bot cannot force a user to rejoin."
        }
    }

    return {
        success: false,
        message: `${modCase.type} cases do not have a reversible punishment.`
    }
}

module.exports = {
    reverseModCase
}
