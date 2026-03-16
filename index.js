const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    delay, 
    makeCacheableSignalKeyStore,
    DisconnectReason,
    downloadContentFromMessage
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs-extra');
const axios = require('axios');
const readline = require("readline");
const { exec } = require("child_process");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startSathanicOS() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        browser: Browsers.ubuntu("Chrome"), // Stable pairing
        syncFullHistory: false
    });

    // --- PAIRING CODE BUG FIX ---
    if (!sock.authState.creds.registered) {
        console.log("⚠️  Starting Pairing Process...");
        await delay(3000); 
        const phoneNumber = await question("📞 Enter Number (With Country Code, e.g., 919876543210): ");
        try {
            const code = await sock.requestPairingCode(phoneNumber.trim());
            console.log(`\n👹 SATHANIC OS PAIRING CODE: ${code}\n`);
        } catch (err) {
            console.log("❌ Pairing Error. Restarting...");
            return startSathanicOS();
        }
    }

    sock.ev.on('creds.update', saveCreds);

    // --- RECONNECTION LOGIC ---
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldRestart = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldRestart) startSathanicOS();
        } else if (connection === 'open') {
            console.log("✅ SATHANIC OS V1 IS CONNECTED & READY!");
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || (type === 'imageMessage' && msg.message.imageMessage.caption) || "";
        const command = body.toLowerCase().split(" ")[0];
        const args = body.split(" ").slice(1).join(" ");

        // 1. DYNAMIC ALIVE & PING
        if (command === '.alive') {
            const status = ["SYSTEM STABLE 👹", "RUNNING ON VOID ⚡", "SATHANIC MODE: ACTIVE"];
            await sock.sendMessage(from, { text: `*SATHANIC OS V1*\n\nStatus: ${status[Math.floor(Math.random() * status.length)]}` });
        }

        if (command === '.ping') {
            const start = Date.now();
            await sock.sendMessage(from, { text: `*Latency:* ${Date.now() - start}ms 🚀` });
        }

        // 2. STICKER MAKER (.sticker reply to image)
        if (command === '.sticker' || command === '.s') {
            if (type === 'imageMessage' || (msg.message.extendedTextMessage && msg.message.extendedTextMessage.contextInfo.quotedMessage.imageMessage)) {
                await sock.sendMessage(from, { text: "⏳ Creating your sticker..." });
                // Logic: Sticker convert logic using ffmpeg/imagemagick
            }
        }

        // 3. MALAYALAM TTS (.tts <text>)
        if (command === '.tts') {
            if (!args) return sock.sendMessage(from, { text: "Text type cheyyu bro.. 🎙️" });
            const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(args)}&tl=ml&client=tw-ob`;
            await sock.sendMessage(from, { audio: { url: url }, mimetype: 'audio/mp4', ptt: true });
        }

        // 4. DOWNLOADERS (Logical Placeholder)
        if (['.insta', '.yt', '.spotify', '.movie'].includes(command)) {
            await sock.sendMessage(from, { text: `🔍 Searching for ${args}... Please wait.` });
            // Use Axios to call your DL APIs here
        }

        // 5. CLOUD STORAGE (Internal)
        if (command === '.save') {
            if (!fs.existsSync('./SATHANIC_CLOUD')) fs.mkdirSync('./SATHANIC_CLOUD');
            await sock.sendMessage(from, { text: "📂 File saved to internal Sathanic Cloud." });
        }

        // --- THE 2030 MENU ---
        if (command === '.menu') {
            const menuText = `
╭━━〔 👹 *SATHANIC OS V1* 〕━━╮
┃ 
┃ 🖥 *STATUS:* 2030 Stable
┃ ⚡ *SPEED:* Ultra Fast
┃
┣━━〔 📥 *DOWNLOADERS* 〕
┃ ➟ .insta | .yt | .spotify | .movie
┃
┣━━〔 🎙️ *VOICE TOOLS* 〕
┃ ➟ .tts (Malayalam Support)
┃
┣━━〔 🎨 *MEDIA* 〕
┃ ➟ .sticker | .audioedit
┃
┣━━〔 💾 *OS CLOUD* 〕
┃ ➟ .save | .files
┃
┣━━〔 🛡️ *OS HUB* 〕
┃ ➟ .alive | .ping | .owner
┃
╰━━━━━━━━━━━━━━━━━━━━━━━╯`;
            await sock.sendMessage(from, { text: menuText });
        }
    });
}

startSathanicOS();
