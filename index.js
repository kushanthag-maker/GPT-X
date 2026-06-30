const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const path = require("path");

const config = require("./config");

global.plugins = [];

// 📦 LOAD PLUGINS (සංශෝධිත)
function loadPlugins() {
    global.plugins = [];
    const pluginsDir = path.join(__dirname, "plugins");

    if (!fs.existsSync(pluginsDir)) {
        console.log("❌ 'plugins' folder not found!");
        return;
    }

    const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith(".js"));

    for (const file of files) {
        try {
            const filePath = path.join(pluginsDir, file);
            delete require.cache[require.resolve(filePath)];
            const plugin = require(filePath);
            global.plugins.push(plugin);
        } catch (e) {
            console.log(`❌ Error loading ${file}:`, e.message);
        }
    }

    console.log("📦 Plugins Loaded:", global.plugins.map(p => p.name).join(", "));
}

loadPlugins();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "open") console.log("🤖 GPT-X BOT ONLINE");
        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        let body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const prefix = config.PREFIX || ".";

        if (!body.startsWith(prefix)) return;

        const command = body.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

        for (const plugin of global.plugins) {
            if (plugin.name === command) {
                try {
                    await plugin.execute({ socket: sock, msg, jid, body, config });
                } catch (e) {
                    console.log("❌ PLUGIN ERROR:", e.message);
                }
            }
        }
    });

    console.log("🚀 GPT-X STARTED");
}

startBot();
