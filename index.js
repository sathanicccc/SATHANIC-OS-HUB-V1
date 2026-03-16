const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    Browsers, 
    delay, 
    makeCacheableSignalKeyStore,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const fs = require('fs-extra');
const readline = require("readline");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise(resolve => rl.question(text, resolve));

async function startSathanic() {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
        },
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // --- CONNECTION HANDLER ---
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (connection === 'close') {
            let reason = lastDisconnect?.error?.output?.statusCode;
            console.log(`❌ Connection Closed. Reason: ${reason}. Restarting...`);
            startSathanic();
        } 
        
        else if (connection === 'open') {
            console.log("\n✅ SATHANIC OS V1 CONNECTED SUCCESSFULLY!\n");
        }

        // ബോട്ട് റെഡിയായിക്കഴിഞ്ഞാൽ മാത്രം Pairing Code ചോദിക്കുന്നു
        if (!sock.authState.creds.registered && !qr) {
            console.log("⏳ Waiting for System to stabilize...");
            await delay(5000); // 5 സെക്കൻഡ് വെയിറ്റ് ചെയ്യുക
            
            try {
                const phoneNumber = await question("\n📞 Enter Phone Number (with 91): ");
                console.log("🔄 Requesting Pairing Code...");
                const code = await sock.requestPairingCode(phoneNumber.trim());
                console.log(`\n👹 YOUR PAIRING CODE: ${code}\n`);
            } catch (err) {
                console.log("❌ Pairing Error:", err.message);
                process.exit(0);
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // --- MESSAGE LOGIC ---
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (body.toLowerCase() === '.alive') {
            await sock.sendMessage(from, { text: "👹 SATHANIC OS HUB V1 IS ACTIVE" });
        }
    });
}

startSathanic();
