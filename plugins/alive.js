module.exports = {
    name: "alive",

    async execute({ socket, jid }) {
        await socket.sendMessage(jid, {
            text: "🤖 GPT-X Bot is Alive and Working Perfectly!"
        });
    }
};
