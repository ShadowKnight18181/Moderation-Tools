const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags
} = require("discord.js")
const { getLogChannel } = require("../utils/logSettings")

const roleColors = {
    default: null,
    red: "#ed4245",
    orange: "#e67e22",
    yellow: "#fee75c",
    green: "#57f287",
    blue: "#3498db",
    purple: "#9b59b6",
    pink: "#e91e63",
    white: "#ffffff",
    gray: "#95a5a6",
    black: "#23272a"
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName("addrole")
        .setDescription("Add a new role with optional color and hoist")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addStringOption(option =>
            option
                .setName("name")
                .setDescription("Name of the new role")
                .setMinLength(1)
                .setMaxLength(100)
                .setRequired(true)
        )
        .addBooleanOption(option =>
            option
                .setName("hoist")
                .setDescription(
                    "Display the role separately in the member list?"
                )
                .setRequired(false)
        )
        .addStringOption(option =>
            option
                .setName("color")
                .setDescription("Color of the role")
                .addChoices(
                    { name: "Default", value: "default" },
                    { name: "Red", value: "red" },
                    { name: "Orange", value: "orange" },
                    { name: "Yellow", value: "yellow" },
                    { name: "Green", value: "green" },
                    { name: "Blue", value: "blue" },
                    { name: "Purple", value: "purple" },
                    { name: "Pink", value: "pink" },
                    { name: "White", value: "white" },
                    { name: "Gray", value: "gray" },
                    { name: "Black", value: "black" }
                )
                .setRequired(false)
        ),

    async execute(interaction) {
        const isOwner = interaction.user.id === interaction.guild.ownerId
        const canManageRoles = interaction.memberPermissions.has(
            PermissionFlagsBits.ManageRoles
        )

        if (!isOwner && !canManageRoles) {
            return interaction.reply({
                content:
                    "Only the server owner or moderators with Manage Roles can use `/addrole`.",
                flags: MessageFlags.Ephemeral
            })
        }

        const botMember = interaction.guild.members.me

        if (
            !botMember?.permissions.has(PermissionFlagsBits.ManageRoles)
        ) {
            return interaction.reply({
                content: "I need the Manage Roles permission to create roles.",
                flags: MessageFlags.Ephemeral
            })
        }

        const name = interaction.options.getString("name").trim()
        const hoist = interaction.options.getBoolean("hoist") || false
        const colorName =
            interaction.options.getString("color") || "default"
        const color = roleColors[colorName]

        if (!name) {
            return interaction.reply({
                content: "The role name cannot be empty.",
                flags: MessageFlags.Ephemeral
            })
        }

        const role = await interaction.guild.roles.create({
            name,
            colors: color ? { primaryColor: color } : undefined,
            hoist,
            reason: `Created by ${interaction.user.tag}`
        })

        await interaction.reply({
            content: `Created the ${role} role.`,
            flags: MessageFlags.Ephemeral
        })

        const logChannel = getLogChannel(interaction.guild)

        if (logChannel?.isTextBased()) {
            const embed = new EmbedBuilder()
                .setColor(color || "#5865f2")
                .setTitle("Role Created")
                .addFields(
                    {
                        name: "Role",
                        value: `${role}\n\`${role.id}\``,
                        inline: true
                    },
                    {
                        name: "Created by",
                        value: `${interaction.user}`,
                        inline: true
                    },
                    {
                        name: "Hoisted",
                        value: hoist ? "Yes" : "No",
                        inline: true
                    },
                    {
                        name: "Color",
                        value:
                            colorName === "default"
                                ? "Default"
                                : colorName[0].toUpperCase() +
                                  colorName.slice(1),
                        inline: true
                    }
                )
                .setTimestamp()

            await logChannel.send({ embeds: [embed] }).catch(console.error)
        }
    }
}
