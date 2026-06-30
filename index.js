const {
    default: makeWASocket,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} = require("@whiskeysockets/baileys");

const P = require("pino");
const fs = require("fs");
const readline = require("readline");

const config = require("./config");

// readline for Termux input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(q) {
    return new Promise(resolve => rl.question(q, resolve));
}

// Load plugins
global.plugins = [];

function loadPlugins() {
    global.plugins = [];
    const files = fs.readdirSync("./plugins").filter(f => f.endsWith(".js"));

    for (const file of files) {
        try {
            delete require.cache[require.resolve(`./plugins/${file}`)];
            const plugin = require(`./plugins/${file}`);
            global.plugins.push(plugin);
        } catch (e) {
            console.log("❌ Plugin Error:", file);
        }
    }
}

loadPlugins();

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        printQRInTerminal: false
    });

    sock.ev.on("creds.update", saveCreds);

    // CONNECTION
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("✅ GPT-X Bot Connected Successfully");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log("❌ Disconnected. Reconnecting:", shouldReconnect);

            if (shouldReconnect) startBot();
        }
    });

    // 🔥 PAIRING CODE SYSTEM (TERMUX)
    if (!sock.authState.creds.registered) {
        console.log("\n🔥 GPT-X PAIRING MODE 🔥\n");

        const number = await ask("📱 Enter WhatsApp Number (94XXXXXXXX): ");

        try {
            const code = await sock.requestPairingCode(number);
            console.log("\n━━━━━━━━━━━━━━━━━━━━━━");
            console.log("🔥 YOUR PAIRING CODE:");
            console.log(code);
            console.log("━━━━━━━━━━━━━━━━━━━━━━\n");

            console.log("👉 Go WhatsApp > Linked Devices > Link with code");
        } catch (e) {
            console.log("❌ Pairing Error:", e.message);
        }
    }

    // MESSAGE HANDLER
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        let body =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            "";

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
