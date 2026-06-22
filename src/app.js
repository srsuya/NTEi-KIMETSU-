
import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ══════════════════════════════════════════
//           CONFIGURAÇÕES GLOBAIS
// ══════════════════════════════════════════
const CONFIG = {
    ownerNumber: '5511999999999', // Substitua pelo seu número sem o @
    senhaAdmin: 'admin@2626',
    senhaNtei: 'ntei@3010',
    dbPath: './database.json',
    lojaPath: './loja.json'
};

const OWNER_JID = `${CONFIG.ownerNumber}@s.whatsapp.net`;

// Sessões temporárias para quem logar via senha (válido por 1 hora)
const sessoesAdmin = new Map();
const sessoesNtei = new Map();
const floodMap = new Map();

// ══════════════════════════════════════════
//   BANCO DE DADOS (JSON INTEGRADO)
// ══════════════════════════════════════════
const DB = {
    carregar() {
        if (!fs.existsSync(CONFIG.dbPath)) {
            const inicial = { usuarios: {}, aldeia: { ienes: 333830 }, logs: [] };
            fs.writeFileSync(CONFIG.dbPath, JSON.stringify(inicial, null, 2));
        }
        return JSON.parse(fs.readFileSync(CONFIG.dbPath));
    },
    salvar(data) {
        fs.writeFileSync(CONFIG.dbPath, JSON.stringify(data, null, 2));
    },
    getUsuario(id, nome = 'Desconhecido') {
        const db = this.carregar();
        if (!db.usuarios[id]) {
            db.usuarios[id] = { 
                nome, id_rpg: 1000 + Object.keys(db.usuarios).length, ienes: 0, eng: 0, xp: 0, nivel: 1, 
                raca: 'Indefinida', familia: 'Nenhuma', nacao: 'Aldeia do Norte', patente: '⏺️ Cidadão', recrutador: 'Sistema' 
            };
            this.salvar(db);
        }
        return { db, usuario: db.usuarios[id] };
    }
};

// ══════════════════════════════════════════
//   HELPERS & EXTRAÇÃO DE CAMPOS
// ══════════════════════════════════════════
function checkFlood(sender) {
    const now = Date.now();
    const data = floodMap.get(sender);
    if (data?.banned && now < data.bannedUntil) return true;
    if (!data || now - data.start > 5000) {
        floodMap.set(sender, { count: 1, start: now, banned: false });
        return false;
    }
    data.count++;
    if (data.count >= 5) {
        data.banned = true;
        data.bannedUntil = now + (5 * 60 * 1000);
        return true;
    }
    return false;
}

function extractText(msg) {
    const m = msg.message;
    if (!m) return '';
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m.viewOnceMessageV2?.message || m.documentWithCaptionMessage?.message || m;
    return inner.conversation || inner.extendedTextMessage?.text || inner.imageMessage?.caption || inner.videoMessage?.caption || '';
}

function extrairCampo(lines, ...termos) {
    for (const termo of termos) {
        const linha = lines.find(l => l.toLowerCase().includes(termo.toLowerCase()));
        if (linha) {
            const partes = linha.split(/[:\⌊\⌉]/);
            for (let i = partes.length - 1; i >= 0; i--) {
                const val = partes[i].replace(/[⌊⌉◈￫🆔🧾⛩️🏙️🔘✒️]/g, '').trim();
                if (val && val.length > 0) return val;
            }
        }
    }
    return null;
}

// ══════════════════════════════════════════
//   PROCESSO PRINCIPAL DO CONECTOR
// ══════════════════════════════════════════
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    // CORREÇÃO DO ERRO DO PRINT: Chamada direta sem .default
    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        console.log("\n🍊 [Tangerina-Bot] CONEXÃO VIA PAREAMENTO TEXTUAL 🍊\n");
        await delay(2000);
        let phoneNumber = await question('Digite o número do WhatsApp do Bot (Ex: 5511999999999): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 CÓDIGO DE CONEXÃO: \x1b[32m${code}\x1b[0m\n`);
            } catch (e) { console.error("Erro ao gerar o código.", e); }
        }
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') console.log('🍊 Tangerina Bot conectado com sucesso no seu Termux!');
        if (connection === 'close') {
            const should = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (should) connectToWhatsApp();
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                const sender = msg.key.participant || remoteJid;
                const text = extractText(msg).trim();
                const senderParam = sender.split('@')[0];

                if (!text) continue;

                const isDonoDireto = (sender === OWNER_JID || `${senderParam}@s.whatsapp.net` === OWNER_JID);
                const hasAdminSession = sessoesAdmin.has(sender) && sessoesAdmin.get(sender) > Date.now();
                const hasNteiSession = sessoesNtei.has(sender) && sessoesNtei.get(sender) > Date.now();

                if (!isDonoDireto && !hasNteiSession && checkFlood(sender)) continue;

                const args = text.split(' ');
                const cmd = args[0].toLowerCase();

                // ═══ SISTEMA DE SENHAS ═══
                if (cmd === '/admin') {
                    const senha = args[1];
                    if (senha === CONFIG.senhaAdmin || isDonoDireto) {
                        sessoesAdmin.set(sender, Date.now() + 3600000);
                        await sock.sendMessage(remoteJid, { text: `╭════════════════════════╗\n│      👑 PAINEL ADMIN    │\n╰════════════════════════╯\n\n╭━━━〔 👥 USUÁRIOS 〕━━━╮\n┃ 🔍 /buscar\n┃ 📜 /historico\n┃ ⚠️ /advertir\n┃ 🚫 /ban\n┃ ♻️ /desban\n┃ 🔇 /mute\n┃ 🔊 /unmute\n┃ 🧹 /limpar-ficha\n╰━━━━━━━━━━━━━━━━━━╯\n\n╭━━━〔 💰 ECONOMIA 〕━━━╮\n┃ 🪙 /add-ienes\n┃ 🪙 /rm-ienes\n┃ ⚙️ /add-eng\n┃ ⚙️ /rm-eng\n┃ 🎁 /bonus\n┃ 🧾 /extrato\n┃ 💸 /gastos\n┃ 📊 /saldo-geral\n╰━━━━━━━━━━━━━━━━━━╯` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "❌ Senha incorreta!" });
                    }
                    continue;
                }

                if (cmd === '/ntei') {
                    const senha = args[1];
                    if (senha === CONFIG.senhaNtei || isDonoDireto) {
                        sessoesNtei.set(sender, Date.now() + 3600000);
                        const { usuario } = DB.getUsuario(sender, msg.pushName);
                        await sock.sendMessage(remoteJid, { text: `╭═══════════════════════════════╮\n│           ☢️ N.T.E.I ☢️         │\n│  NÚCLEO TECNOLÓGICO ESTRATÉGICO │\n│            IMPERIAL            │\n╰═══════════════════════════════╯\n\n┌〔 🔴 ACESSO OMEGA 〕┐\n│ Usuário: ${usuario.nome}\n│ Cargo: Diretor NTEI\n│ Permissão: Máxima\n└───────────────────┘\n\n╭━━━〔 💰 ECONOMIA GLOBAL 〕━━━╮\n┃ 💸 /gastos\n┃ 📈 /fluxocaixa\n┃ 🪙 /economia-global\n┃ 🏦 /banco-rpg\n╰━━━━━━━━━━━━━━━━━━━━━━╯` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "❌ Acesso OMEGA Negado!" });
                    }
                    continue;
                }

                // ═══ MENU DE USUÁRIO ═══
                if (cmd === '/menu' || cmd === '/ajuda') {
                    const { usuario } = DB.getUsuario(sender, msg.pushName);
                    await sock.sendMessage(remoteJid, { text: `╭━━━〔 🍊 𝙏𝘼𝙉𝙂𝙀𝙍𝙄𝙉𝘼 𝘽𝙊𝙏 🍊 〕━━━╮\n┃\n┃ 👤 Usuário: ${usuario.nome}\n┃ 🏮 Organização: Caçadores\n┃ 💰 Ienes: ${usuario.ienes}\n┃ ⚙️ Engrenagens: ${usuario.eng}\n┃ 📈 Nível: ${usuario.nivel}\n┃\n╰━━━━━━━━━━━━━━━━━━━━━╯\n\n╭─❖「 📚 CENTRAL 」❖─╮\n│ 📜 /regras-basicas\n│ 📅 /cronograma\n╰─────────────────╯` });
                    continue;
                }

                // ═══ INTERCEPTAÇÃO AUTOMÁTICA DE FICHA ═══
                if (text.includes('RECRUTAMENTO APROVADO') || text.includes('Nick:')) {
                    const lines = text.split('\n');
                    const nick = extrairCampo(lines, 'Nick:', 'Nick Escolhido:');
                    if (nick) {
                        const dbData = DB.carregar();
                        if (dbData.usuarios[sender]) continue;

                        const novoId = 1000 + Object.keys(dbData.usuarios).length;
                        const fam = extrairCampo(lines, 'Família:', 'Familia:') || 'Tomioka';
                        const nac = extrairCampo(lines, 'Nação:', 'Nacao:') || 'Aldeia do Norte';
                        const rec = extrairCampo(lines, 'Recrutador:') || 'Sistema';

                        dbData.usuarios[sender] = {
                            nome: nick, id_rpg: novoId, ienes: 0, eng: 0, xp: 0, nivel: 1,
                            raca: 'Indefinida', familia: fam, nacao: nac, patente: '⏺️ Cidadão', recrutador: rec
                        };
                        DB.salvar(dbData);

                        await sock.sendMessage(remoteJid, {
                            text: `➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄\n🤺 ᗂ ⛩️ Kimetsu New Age ⛩️ ᗃ 🤺\n\n📃 RECRUTAMENTO APROVADO! 📃\n_￫🆔◈ ID:  ⌊ ${novoId} ⌉_\n_￫🧾◈ Nick:  ⌊ ${nick} ⌉_\n_￫🧬◈ Raça:  ⌊ ❓ Indefinida ⌉_\n_￫⛩️◈ Família:  ⌊ ${fam} ⌉_\n_￫🏙️◈ Nação:  ⌊ ${nac} ⌉_\n_￫🔘◈ Patente:  ⌊ ⏺️ Cidadão ⌉_\n_￫✒️◈ Recrutador:  ⌊ ${rec} ⌉_\n➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄\n🍊 Bem-vindo(a) ao RPG, @${senderParam}!\nUse */escolher raça Humano* ou */escolher raça Oni* para definir sua raça!`,
                            mentions: [sender]
                        });
                        continue;
                    }
                }

                // ═══ ESCOLHA DE RAÇAS OU FAMÍLIAS ═══
                if (cmd === '/escolher') {
                    const tipo = args[1]?.toLowerCase();
                    const escolha = args.slice(2).join(' ');
                    const { db, usuario } = DB.getUsuario(sender, msg.pushName);

                    if (tipo === 'raça' || tipo === 'raca') {
                        if (usuario.raca !== 'Indefinida') {
                            await sock.sendMessage(remoteJid, { text: `❌ Você já pertence à raça ${usuario.raca}!` });
                            continue;
                        }
                        usuario.raca = escolha.toLowerCase() === 'oni' ? '👹 Oni' : '👱‍♂️ Humano';
                        db.usuarios[sender] = usuario;
                        DB.salvar(db);
                        await sock.sendMessage(remoteJid, { text: `✅ Sucesso! Agora você é um: *${usuario.raca}*!` });
                    }
                    continue;
                }

            } catch (err) { console.error("Erro interno:", err); }
        }
    });
}

connectToWhatsApp();
