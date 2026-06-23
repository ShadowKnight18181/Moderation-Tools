const {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags
} = require("discord.js")
const { recordAction } = require("../utils/actionAttribution")

module.exports = {
    data: new SlashCommandBuilder()
        .setName("nick")
        .setDescription("Manage a member's server nickname")
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addSubcommand(subcommand =>
            subcommand
                .setName("set")
                .setDescription("Set a member's nickname")
                .addUserOption(option =>
                    option
                        .setName("member")
                        .setDescription("Member whose nickname to change")
                        .setRequired(true)
                )
                .addStringOption(option =>
                    option
                        .setName("nickname")
                        .setDescription("New nickname")
                        .setMinLength(1)
                        .setMaxLength(32)
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName("reset")
                .setDescription("Reset a member's nickname")
                .addUserOption(option =>
                    option
                        .setName("member")
                        .setDescription("Member whose nickname to reset")
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ManageNicknames
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to manage nicknames.",
                flags: MessageFlags.Ephemeral
            })
        }

        const member = interaction.options.getMember("member")
        const subcommand = interaction.options.getSubcommand()

        if (!member) {
            return interaction.reply({
                content: "That member could not be found.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (member.id === interaction.guild.ownerId) {
            return interaction.reply({
                content: "The server owner's nickname cannot be changed.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (
            member.roles.highest.position >=
                interaction.member.roles.highest.position &&
            interaction.user.id !== interaction.guild.ownerId
        ) {
            return interaction.reply({
                content:
                    "You cannot change the nickname of a member with an equal or higher role.",
                flags: MessageFlags.Ephemeral
            })
        }

        if (!member.manageable) {
            return interaction.reply({
                content:
                    "I cannot change that member's nickname. Check my role position and permissions.",
                flags: MessageFlags.Ephemeral
            })
        }

        const nickname =
            subcommand === "set"
                ? interaction.options.getString("nickname")
                : null

        recordAction(
            interaction.guild.id,
            member.id,
            "nickname",
            interaction.user
        )

        await member.setNickname(
            nickname,
            `Nickname ${subcommand} by ${interaction.user.tag}`
        )

        await interaction.reply({
            content:
                subcommand === "set"
                    ? `${member}'s nickname was set to **${nickname}**.`
                    : `${member.user}'s nickname was reset.`,
            flags: MessageFlags.Ephemeral
        })
    }
}
