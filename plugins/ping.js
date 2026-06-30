module.exports = {
    name: "ping",

    async execute({ socket, msg, jid }) {
        const start = Date.now();

        await socket.sendMessage(jid, {
            text: "🏓 Pinging..."
        });

        const end = Date.now();

        await socket.sendMessage(jid, {
            text: `⚡ Pong!\nSpeed: ${end - start}ms`
        });
    }
};
