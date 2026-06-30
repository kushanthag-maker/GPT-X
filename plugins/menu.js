const config = require("../config");

module.exports = {
    name: "menu",

    async execute({ socket, jid }) {

        // IMAGE MENU
        await socket.sendMessage(jid, {
            image: { url: config.MENU_IMAGE },
            caption:
`🤖 *${config.BOT_NAME} MENU*

👾 Commands:
• .ping
• .alive
• .menu

⚡ Powered by GPT-X`
        });

        // VIDEO MENU
        await socket.sendMessage(jid, {
            video: { url: config.MENU_VIDEO },
            caption: "🎬 GPT-X Video Menu",
            gifPlayback: false
        });
    }
};
