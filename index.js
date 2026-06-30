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

// Load plugins
function loadPlugins() {
    global.plugins = [];
    const files = fs.readdirSync("./plugins").filter(f => f.endsWith(".js"));

    for (const file of files) {
        delete require.cache[require.resolve(`./plugins/${file}`)];
        const plugin = require(`./plugins/${file}`);
        global.plugins.push(plugin);
    }
}

loadPlugins();

// 🔥 AUTO RECONNECT SAFE START
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

    // 🔥 CONNECTION FIX (AUTO RECONNECT)
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("🤖 GPT-X BOT ACTIVE");
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            console.log("❌ Disconnected. Reconnecting:", shouldReconnect);

            if (shouldReconnect) startBot();
        }
    });

    // 🔥 MESSAGE FIX (PUBLIC CHAT WORKING)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        let body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        // DEBUG (important)
        console.log("📩 New Message:", body);

        for (const plugin of global.plugins) {
            try {
                if (body.toLowerCase().startsWith(plugin.name)) {
                    await plugin.execute({
                        socket: sock,
                        msg,
                        jid,
                        body,
                        config
                    });
                }
            } catch (e) {
                console.log("❌ Plugin Error:", e.message);
            }
        }
    });
}

startBot();
