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
    // ✅ SESSION (MUST - stable login)
    const { state, saveCreds } = await useMultiFileAuthState("./session");

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    // 🔄 CONNECTION
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;

        console.log("🔄 Status:", connection);

        if (connection === "open") {
            console.log("🤖 GPT-X BOT ONLINE");
        }

        if (connection === "close") {
            const code = lastDisconnect?.error?.output?.statusCode;

            console.log("❌ Closed:", code);

            const shouldReconnect = code !== DisconnectReason.loggedOut;

            if (shouldReconnect) {
                console.log("♻️ Reconnecting...");
                startBot();
            }
        }
    });

    // 📩 MESSAGES
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        let body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

        console.log("📩 MSG:", body);

        const prefix = config.PREFIX || ".";

        if (!body.startsWith(prefix)) return;

        const command = body.slice(prefix.length).trim().toLowerCase();

        console.log("⚡ CMD:", command);

        for (const plugin of global.plugins) {
            try {
                if (plugin.name === command) {
                    console.log("✅ RUN:", command);

                    await plugin.execute({
                        socket: sock,
                        msg,
                        jid,
                        body,
                        config
                    });
                }
            } catch (e) {
                console.log("❌ ERROR:", e.message);
            }
        }
    });

    console.log("🚀 GPT-X STARTED");
}

startBot();
