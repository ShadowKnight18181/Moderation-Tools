require("dotenv").config()

const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    PermissionFlagsBits,
    EmbedBuilder,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    Partials,
    REST,
    Routes
} = require("discord.js")
const {
    recordMessage,
    getMessageHistoryPage
} = require("./utils/messageHistory.js")

const warnCommand = require("./commands/warn.js")
const warningsCommand = require("./commands/warnings.js")
const removeWarningCommand = require("./commands/remove-warning.js")
const clearWarningsCommand = require("./commands/clear-warnings.js")
const muteCommand = require("./commands/mute.js")
const unmuteCommand = require("./commands/unmute.js")
const kickCommand = require("./commands/kick.js")
const banCommand = require("./commands/ban.js")
const tempbanCommand = require("./commands/tempban.js")
const unbanCommand = require("./commands/unban.js")
const lockCommand = require("./commands/lock.js")
const lockdownCommand = require("./commands/lockdown.js")
const unlockCommand = require("./commands/unlock.js")
const purgeCommand = require("./commands/purge.js")
const sayCommand = require("./commands/say.js")
const lockedCommand = require("./commands/locked.js")
const slowmodeCommand = require("./commands/slowmode.js")
const addroleCommand = require("./commands/addrole.js")
const roleCommand = require("./commands/role.js")
const delroleCommand = require("./commands/delrole.js")
const roleinfoCommand = require("./commands/roleinfo.js")
const userinfoCommand = require("./commands/userinfo.js")
const caseCommand = require("./commands/case.js")
const caselistCommand = require("./commands/caselist.js")
const avatarCommand = require("./commands/avatar.js")
const antispamCommand = require("./commands/antispam.js")
const nickCommand = require("./commands/nick.js")
const setlogCommand = require("./commands/setlog.js")
const antijoinCommand = require("./commands/antijoin.js")
const statusCommand = require("./commands/status.js")
const blockedwordCommand = require("./commands/blockedword.js")
const backupCommand = require("./commands/backup.js")
const { restoreTempBans } = require("./utils/tempBans.js")
const { registerServerEventLogs } = require("./utils/serverEventLogs.js")
const { registerAntiSpam } = require("./utils/antiSpam.js")
const {
    registerAntiJoin,
    restoreAntiJoin
} = require("./utils/antiJoin.js")
const {
    registerBlockedWords
} = require("./utils/blockedWords.js")

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [
        Partials.Message,
        Partials.Channel
    ]
})

registerServerEventLogs(client)
registerAntiSpam(client)
registerAntiJoin(client)
registerBlockedWords(client)

client.commands = new Collection()
client.commands.set(warnCommand.data.name, warnCommand)
client.commands.set(warningsCommand.data.name, warningsCommand)
client.commands.set(removeWarningCommand.data.name, removeWarningCommand)
client.commands.set(clearWarningsCommand.data.name, clearWarningsCommand)
client.commands.set(muteCommand.data.name, muteCommand)
client.commands.set(unmuteCommand.data.name, unmuteCommand)
client.commands.set(kickCommand.data.name, kickCommand)
client.commands.set(banCommand.data.name, banCommand)
client.commands.set(tempbanCommand.data.name, tempbanCommand)
client.commands.set(unbanCommand.data.name, unbanCommand)
client.commands.set(lockCommand.data.name, lockCommand)
client.commands.set(lockdownCommand.data.name, lockdownCommand)
client.commands.set(unlockCommand.data.name, unlockCommand)
client.commands.set(purgeCommand.data.name, purgeCommand)
client.commands.set(sayCommand.data.name, sayCommand)
client.commands.set(lockedCommand.data.name, lockedCommand)
client.commands.set(slowmodeCommand.data.name, slowmodeCommand)
client.commands.set(addroleCommand.data.name, addroleCommand)
client.commands.set(roleCommand.data.name, roleCommand)
client.commands.set(delroleCommand.data.name, delroleCommand)
client.commands.set(roleinfoCommand.data.name, roleinfoCommand)
client.commands.set(userinfoCommand.data.name, userinfoCommand)
client.commands.set(caseCommand.data.name, caseCommand)
client.commands.set(caselistCommand.data.name, caselistCommand)
client.commands.set(avatarCommand.data.name, avatarCommand)
client.commands.set(antispamCommand.data.name, antispamCommand)
client.commands.set(nickCommand.data.name, nickCommand)
client.commands.set(setlogCommand.data.name, setlogCommand)
client.commands.set(antijoinCommand.data.name, antijoinCommand)
client.commands.set(statusCommand.data.name, statusCommand)
client.commands.set(blockedwordCommand.data.name, blockedwordCommand)
client.commands.set(backupCommand.data.name, backupCommand)

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

client.once(Events.ClientReady, async readyClient => {
    console.log(`Moderation bot online as ${readyClient.user.tag}`)
    restoreTempBans(readyClient)
    restoreAntiJoin(readyClient)

    try {
        await rest.put(
            Routes.applicationGuildCommands(
                process.env.CLIENT_ID,
                process.env.GUILD_ID
            ),
            {
                body: client.commands.map(command => command.data.toJSON())
            }
        )

        console.log("Slash commands registered.")
    } catch (error) {
        console.error("Command registration failed:", error)
    }
})

client.on(Events.MessageCreate, message => {
    recordMessage(message)
})

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        const isHistoryOpen = interaction.customId.startsWith(
            "message_history_open:"
        )
        const isHistoryPage = interaction.customId.startsWith(
            "message_history:"
        )

        if (!isHistoryOpen && !isHistoryPage) return

        if (
            !interaction.memberPermissions.has(
                PermissionFlagsBits.ModerateMembers
            )
        ) {
            return interaction.reply({
                content: "You do not have permission to view message history.",
                flags: MessageFlags.Ephemeral
            })
        }

        const [, userId, requestedPage = "0"] =
            interaction.customId.split(":")
        const history = getMessageHistoryPage(
            interaction.guild.id,
            userId,
            Number(requestedPage)
        )
        const user = await interaction.client.users
            .fetch(userId)
            .catch(() => null)

        if (history.total === 0) {
            return interaction.reply({
                content:
                    "No recorded messages were found. History only includes messages sent after tracking was enabled.",
                flags: MessageFlags.Ephemeral
            })
        }

        const description = history.messages
            .map(message => {
                const timestamp = Math.floor(
                    new Date(message.createdAt).getTime() / 1000
                )
                const content = message.content
                    ? message.content.replace(/\n/g, " ").slice(0, 180)
                    : "[Attachment only]"
                const link =
                    `https://discord.com/channels/${interaction.guild.id}/` +
                    `${message.channelId}/${message.messageId}`

                return (
                    `<#${message.channelId}> • <t:${timestamp}:R> • ` +
                    `[Jump](${link})\n${content}`
                )
            })
            .join("\n\n")
            .slice(0, 4096)

        const embed = new EmbedBuilder()
            .setColor("#5865f2")
            .setTitle(
                `Message history — ${user?.tag || "Unknown user"}`
            )
            .setDescription(description)
            .setFooter({
                text:
                    `${history.total} stored message(s) • ` +
                    `Page ${history.page + 1} of ${history.totalPages}`
            })
            .setTimestamp()

        const pagination = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(
                    `message_history:${userId}:${history.page - 1}`
                )
                .setLabel("Previous")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(history.page === 0),
            new ButtonBuilder()
                .setCustomId(
                    `message_history:${userId}:${history.page + 1}`
                )
                .setLabel("Next")
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(history.page >= history.totalPages - 1)
        )

        const response = {
            embeds: [embed],
            components: [pagination],
            flags: MessageFlags.Ephemeral
        }

        if (isHistoryPage) {
            delete response.flags
            return interaction.update(response)
        }

        return interaction.reply(response)
    }

    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command) return

    try {
        await command.execute(interaction)
    } catch (error) {
        console.error(error)

        const response = {
            content: "An error occurred while running this command.",
            flags: MessageFlags.Ephemeral
        }

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response)
        } else {
            await interaction.reply(response)
        }
    }
})

client.login(process.env.DISCORD_TOKEN)
