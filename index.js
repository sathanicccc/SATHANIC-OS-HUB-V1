const { default: makeWASocket, useMultiFileAuthState, Browsers, delay, makeCacheableSignalKeyStore } = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs-extra');
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startSathanic() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        printQRInTerminal: false,
        browser: Browsers.macOS("Desktop")
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = await question("📞 Enter Number (Ex: 91xxxx): ");
        const code = await sock.requestPairingCode(phoneNumber.trim());
        console.log(`\n👹 YOUR PAIRING CODE: ${code}\n`);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const command = body.toLowerCase().split(" ")[0];
        const args = body.split(" ").slice(1).join(" ");

        // --- DYNAMIC ALIVE & PING ---
        if (command === '.alive') {
            const aliveMsg = ["System Online 2030", "Sathanic OS: Active 👹", "Void Status: Stable"];
            await sock.sendMessage(from, { text: `⚡ ${aliveMsg[Math.floor(Math.random() * aliveMsg.length)]}` });
        }

        // --- CLOUD STORAGE (INTERNAL) ---
        if (command === '.save') {
            if (!fs.existsSync('./SATHANIC_CLOUD')) fs.mkdirSync('./SATHANIC_CLOUD');
            await sock.sendMessage(from, { text: "📂 Saving to Internal Cloud..." });
        }

        // --- MENU (100+ FEATURES STYLE) ---
        if (command === '.menu') {
            const menu = `
╭━━〔 👹 *SATHANIC OS V1* 〕━━╮
┃
┣━━〔 📥 *DOWNLOADERS* 〕
┃ ➟ .insta <link> | .yt <link>
┃ ➟ .spotify <song> | .movie <name>
┃
┣━━〔 🎙️ *MALAYALAM TTS* 〕
┃ ➟ .tts <text> (Natural ML Voice)
┃
┣━━〔 🎨 *EDITING* 〕
┃ ➟ .sticker | .audioedit | .bass
┃
┣━━〔 💾 *OS STORAGE* 〕
┃ ➟ .cloud save | .cloud list
┃
┣━━〔 ⚙️ *100+ FEATURES* 〕
┃ ➟ .ping | .owner | .group | .kick
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
            await sock.sendMessage(from, { text: menu });
        }
    });
}
startSathanic();
