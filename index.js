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

// 🔥 LOAD PLUGINS
function loadPlugins() {
    global.plugins = [];
    const files = fs.readdirSync("./plugins").filter(f => f.endsWith(".js"));

    for (const file of files) {
        delete require.cache[require.resolve(`./plugins/${file}`)];
        const plugin = require(`./plugins/${file}`);
        global.plugins.push(plugin);
    }

    console.log("📦 Plugins Loaded:", global.plugins.length);
}

loadPlugins();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,

        // 🔥 IMPORTANT: FULL LOG ENABLE
        logger: P({
            level: "debug"   // 👈 ALL LOGS SHOW
        })
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔥 CONNECTION LOGS
    sock.ev.on("connection.update", (update) => {
        console.log("🔄 CONNECTION UPDATE:", update);

        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ BOT ONLINE - GPT-X ACTIVE");
        }

        if (connection === "close") {
            const statusCode = lastDisconnect?.error?.output?.statusCode;

            console.log("❌ CLOSED CODE:", statusCode);

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            console.log("♻️ RECONNECT:", shouldReconnect);

            if (shouldReconnect) startBot();
        }
    });

    // 🔥 MESSAGE LOG SYSTEM (IMPORTANT FIX)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];

        console.log("\n📩 NEW RAW MESSAGE:");
        console.log(JSON.stringify(msg, null, 2)); // 👈 FULL MESSAGE LOG

        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        let body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        console.log("💬 MESSAGE TEXT:", body); // 👈 TEXT LOG

        for (const plugin of global.plugins) {
            try {
                if (body.toLowerCase().startsWith(plugin.name)) {
                    console.log("⚡ COMMAND TRIGGERED:", plugin.name);

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

    console.log("🚀 BOT STARTING...");
}

startBot();
