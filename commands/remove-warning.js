const fs = require("fs")
const path = require("path")

const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { getModCase } = require("../utils/modCases")
const { getLogChannel } = require("../utils/logSettings")

const warningsPath = path.join(__dirname, "../data/warnings.json")

function readWarnings() {
    return JSON.parse(fs.readFileSync(warningsPath, "utf8"))
}

function saveWarnings(warnings) {
    fs.writeFileSync(warningsPath, JSON.stringify(warnings, null, 2))
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("remove-warning")
        .setDescription("Remove one warning from a member")
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(option =>
            option
                .setName("member")
                .setDescription("Member whose warning should be removed")
                .setRequired(true)
        )
        .addStringOption(option =>
            option
                .setName("warning-id")
                .setDescription("Warning ID or moderation case ID")
                .setRequired(true)
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ModerateMembers
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to manage warnings.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("member")
        const requestedId =
            interaction.options.getString("warning-id").trim()

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                flags: MessageFlags.Ephemeral
            })
        }

        const warnings = readWarnings()
        const memberWarnings =
            warnings[interaction.guild.id]?.[member.id] || []

        let warningIndex = memberWarnings.findIndex(
            warning => warning.id.toLowerCase() === requestedId.toLowerCase()
        )
        let linkedCase = null

        if (warningIndex === -1) {
            linkedCase = getModCase(interaction.guild.id, requestedId)

            if (
                linkedCase?.type === "WARN" &&
                linkedCase.userId === member.id
            ) {
                if (linkedCase.details?.warningId) {
                    warningIndex = memberWarnings.findIndex(
                        warning =>
                            warning.id.toLowerCase() ===
                            linkedCase.details.warningId.toLowerCase()
                    )
                } else {
                    warningIndex = memberWarnings.findIndex(warning => {
                        const timeDifference = Math.abs(
                            new Date(warning.createdAt).getTime() -
                                new Date(linkedCase.createdAt).getTime()
                        )

                        return (
                            warning.moderatorId === linkedCase.moderatorId &&
                            warning.reason === linkedCase.reason &&
                            timeDifference <= 5_000
                        )
                    })
                }
            }
        }

        if (warningIndex === -1) {
            return interaction.reply({
                content:
                    `No warning or warning case with ID ` +
                    `\`${requestedId}\` was found for ${member}.`,
                flags: MessageFlags.Ephemeral
            })
        }

        const [removedWarning] = memberWarnings.splice(warningIndex, 1)

        if (memberWarnings.length === 0) {
            delete warnings[interaction.guild.id][member.id]
        }

        saveWarnings(warnings)

        await interaction.reply({
            content:
                `Removed warning \`${removedWarning.id}\` from ${member}.` +
                (linkedCase ? ` Case: \`${linkedCase.id}\`.` : ""),
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor("#57f287")
                .setTitle("Warning Removed")
                .addFields(
                    { name: "Member", value: `${member}`, inline: true },
                    {
                        name: "Removed by",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Warning ID",
                        value: removedWarning.id
                    },
                    {
                        name: "Original reason",
                        value: removedWarning.reason
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
