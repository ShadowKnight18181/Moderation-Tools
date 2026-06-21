require("dotenv").config()

const {
    Client,
    Collection,
    Events,
    GatewayIntentBits,
    REST,
    Routes
} = require("discord.js")

const warnCommand = require("./commands/warn.js")
const warningsCommand = require("./commands/warnings.js")
const removeWarningCommand = require("./commands/remove-warning.js")
const clearWarningsCommand = require("./commands/clear-warnings.js")
const muteCommand = require("./commands/mute.js")
const unmuteCommand = require("./commands/unmute.js")
const kickCommand = require("./commands/kick.js")
const banCommand = require("./commands/ban.js")
const unbanCommand = require("./commands/unban.js")
const lockCommand = require("./commands/lock.js")
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

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildModeration
    ]
})

client.commands = new Collection()
client.commands.set(warnCommand.data.name, warnCommand)
client.commands.set(warningsCommand.data.name, warningsCommand)
client.commands.set(removeWarningCommand.data.name, removeWarningCommand)
client.commands.set(clearWarningsCommand.data.name, clearWarningsCommand)
client.commands.set(muteCommand.data.name, muteCommand)
client.commands.set(unmuteCommand.data.name, unmuteCommand)
client.commands.set(kickCommand.data.name, kickCommand)
client.commands.set(banCommand.data.name, banCommand)
client.commands.set(unbanCommand.data.name, unbanCommand)
client.commands.set(lockCommand.data.name, lockCommand)
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

const rest = new REST().setToken(process.env.DISCORD_TOKEN)

client.once(Events.ClientReady, async readyClient => {
    console.log(`Moderation bot online as ${readyClient.user.tag}`)

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

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand()) return

    const command = client.commands.get(interaction.commandName)
    if (!command) return

    try {
        await command.execute(interaction)
    } catch (error) {
        console.error(error)

        const response = {
            content: "An error occurred while running this command.",
            ephemeral: true
        }

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(response)
        } else {
            await interaction.reply(response)
        }
    }
})

client.login(process.env.DISCORD_TOKEN)
