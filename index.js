const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");

const config = require("./config");

global.plugins = [];

// 📦 LOAD PLUGINS
function loadPlugins() {
    global.plugins = [];

    const files = fs.readdirSync("./plugins").filter(f => f.endsWith(".js"));

    for (const file of files) {
        delete require.cache[require.resolve(`./plugins/${file}`)];
        const plugin = require(`./plugins/${file}`);
        global.plugins.push(plugin);
    }

    console.log("📦 Plugins Loaded:", global.plugins.map(p => p.name));
}

loadPlugins();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 CONNECTION FIX + AUTO RECONNECT
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        console.log("🔄 Connection Update:", connection);

        if (connection === "open") {
            console.log("🤖 GPT-X BOT ONLINE");
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Disconnected Code:", statusCode);

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            console.log("♻️ Reconnecting:", shouldReconnect);

            if (shouldReconnect) startBot();
        }
    });

    // 🔥 MESSAGE HANDLER (FIXED)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        let body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        console.log("\n📩 MESSAGE:", body);

        // 🔥 PREFIX SYSTEM FIX
        const prefix = ".";

        if (!body.startsWith(prefix)) return;

        const command = body.slice(prefix.length).trim().toLowerCase();

        console.log("⚡ COMMAND DETECTED:", command);

        // 🔥 PLUGIN EXECUTION
        for (const plugin of global.plugins) {
            try {
                if (plugin.name === command) {
                    console.log("✅ EXECUTING:", command);

                    await plugin.execute({
                        socket: sock,
                        msg,
                        jid,
                        body,
                        config
                    });
                }
            } catch (e) {
                console.log("❌ PLUGIN ERROR:", e.message);
            }
        }
    });

    console.log("🚀 GPT-X BOT STARTED");
}

startBot();
