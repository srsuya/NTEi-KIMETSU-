import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import { runMigrations } from './database/migrations/init.js';
import { runShopMigrations } from './database/migrations/shop_init.js';
import db from './database/connection.js';

import { commandPerfil } from './commands/rpg/perfil.js';
import { commandLoja, commandComprar } from './commands/shop/shopCmds.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ══════════════════════════════════════════
//           CONFIGURAÇÕES GLOBAIS
// ══════════════════════════════════════════
const OWNER_NUMBER = '5511999999999'; // Substitua pelo seu número sem o @
const OWNER_JID = `${OWNER_NUMBER}@s.whatsapp.net`;

const SENHA_ADMIN = 'admin@2626';
const SENHA_NTEI = 'ntei@3010';

// Estrutura para sessões ativas temporárias de Admin/NTEI por tempo (1 hora de login)
const sessoesAdmin = new Map(); // jid -> timestamp_expira
const sessoesNtei = new Map();  // jid -> timestamp_expira

// ══════════════════════════════════════════
//           ANTI-FLOOD & ANTI-LINK
// ══════════════════════════════════════════
const floodMap = new Map();
const FLOOD_LIMIT = 5;       
const FLOOD_WINDOW = 5000;   
const FLOOD_BAN = 5 * 60 * 1000; 
const LINK_REGEX = /(https?:\/\/|www\.|chat\.whatsapp\.com)/i;

function checkFlood(sender) {
    const now = Date.now();
    const data = floodMap.get(sender);
    if (data?.banned && now < data.bannedUntil) return true;
    if (!data || now - data.start > FLOOD_WINDOW) {
        floodMap.set(sender, { count: 1, start: now, banned: false });
        return false;
    }
    data.count++;
    if (data.count >= FLOOD_LIMIT) {
        data.banned = true;
        data.bannedUntil = now + FLOOD_BAN;
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

// ══════════════════════════════════════════
//           EXTRAIR VALORES DA FICHA
// ══════════════════════════════════════════
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

// Inicializar banco de dados
runMigrations();
runShopMigrations();

try {
    db.prepare(`CREATE TABLE IF NOT EXISTS admins (jid TEXT PRIMARY KEY, nivel TEXT DEFAULT 'admin')`).run();
} catch(e) {}
try { db.prepare('ALTER TABLE jogadores ADD COLUMN raca TEXT DEFAULT "Indefinida"').run(); } catch(e) {}
try { db.prepare('ALTER TABLE jogadores ADD COLUMN recrutador TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE jogadores ADD COLUMN nacao TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE jogadores ADD COLUMN engrenagens INTEGER DEFAULT 0').run(); } catch(e) {}
try { db.prepare('ALTER TABLE jogadores ADD COLUMN nivel INTEGER DEFAULT 1').run(); } catch(e) {}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket.default({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('Chrome')
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        console.log("\n🍊 [Tangerina-Bot] SISTEMA DE PAREAMENTO POR TEXTO 🍊\n");
        await delay(3000);
        let phoneNumber = await question('Digite o número do WhatsApp do Bot (Ex: 5511999999999): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 SEU CÓDIGO DE CONEXÃO: \x1b[32m${code}\x1b[0m\n`);
            } catch (e) { console.error("Erro ao gerar código.", e); }
        }
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') console.log('🍊 Tangerina Bot conectado com sucesso!');
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
                const isGroup = remoteJid.endsWith('@g.us');
                const senderParam = sender.split('@')[0];

                if (!text) continue;

                // Verificações de nível (Donos diretos ignoram senhas)
                const isDonoDireto = (sender === OWNER_JID || `${senderParam}@s.whatsapp.net` === OWNER_JID);
                const hasAdminSession = sessoesAdmin.has(sender) && sessoesAdmin.get(sender) > Date.now();
                const hasNteiSession = sessoesNtei.has(sender) && sessoesNtei.get(sender) > Date.now();

                // Anti-Flood
                if (!isDonoDireto && !hasNteiSession && checkFlood(sender)) continue;

                // Anti-Link
                if (isGroup && !isDonoDireto && !hasNteiSession && LINK_REGEX.test(text)) {
                    await sock.sendMessage(remoteJid, { delete: msg.key });
                    continue;
                }

                const args = text.split(' ');
                const cmd = args[0].toLowerCase();

                // ══════════════════════════════════════════
                //    SISTEMA DE AUTENTICAÇÃO / LOGIN
                // ══════════════════════════════════════════
                if (cmd === '/admin') {
                    const senhaInfo = args[1];
                    if (!senhaInfo) {
                        await sock.sendMessage(remoteJid, { text: `⚠️ Para acessar o Painel Admin utilize:\n*/admin senha*` });
                        continue;
                    }
                    if (senhaInfo === SENHA_ADMIN || isDonoDireto) {
                        sessoesAdmin.set(sender, Date.now() + 60 * 60 * 1000); // 1 hora de acesso
                        await sock.sendMessage(remoteJid, { text:
`╭════════════════════════╗
│      👑 PAINEL ADMIN    │
╰════════════════════════╯

╭━━━〔 👥 USUÁRIOS 〕━━━╮
┃ 🔍 /buscar
┃ 📜 /historico
┃ ⚠️ /advertir
┃ 🚫 /ban
┃ ♻️ /desban
┃ 🔇 /mute
┃ 🔊 /unmute
┃ 🧹 /limpar-ficha
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 💰 ECONOMIA 〕━━━╮
┃ 🪙 /add-ienes
┃ 🪙 /rm-ienes
┃ ⚙️ /add-eng
┃ ⚙️ /rm-eng
┃ 🎁 /bonus
┃ 🧾 /extrato
┃ 💸 /gastos
┃ 📊 /saldo-geral
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🏪 LOJAS 〕━━━╮
┃ ➕ /add-item
┃ ➖ /rm-item
┃ 💰 /alterar-preco
┃ 📦 /estoque
┃ 🏪 /gerenciar-loja
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 ⚔️ RPG 〕━━━╮
┃ 🎯 /criar-missao
┃ 🎲 /evento
┃ 🏆 /ranking
┃ 📈 /add-xp
┃ 📉 /rm-xp
┃ 🏮 /gerenciar-familias
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 📊 RELATÓRIOS 〕━━━╮
┃ 📋 /logs
┃ 📈 /atividade
┃ 💰 /movimentacoes
┃ 👥 /usuarios
┃ 🚨 /denuncias
╰━━━━━━━━━━━━━━━━━━╯` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: `❌ Senha administrativa incorreta!` });
                    }
                    continue;
                }

                if (cmd === '/ntei') {
                    const senhaInfo = args[1];
                    if (!senhaInfo) {
                        await sock.sendMessage(remoteJid, { text: `⚠️ Para acessar o Painel OMEGA utilize:\n*/ntei senha*` });
                        continue;
                    }
                    if (senhaInfo === SENHA_NTEI || isDonoDireto) {
                        sessoesNtei.set(sender, Date.now() + 60 * 60 * 1000);
                        let jogador = db.prepare('SELECT nick FROM jogadores WHERE jid = ?').get(sender) || { nick: msg.pushName || 'Diretor' };

                        await sock.sendMessage(remoteJid, { text:
`╭═══════════════════════════════╮
│           ☢️ N.T.E.I ☢️         │
│  NÚCLEO TECNOLÓGICO ESTRATÉGICO │
│            IMPERIAL            │
╰═══════════════════════════════╯

┌〔 🔴 ACESSO OMEGA 〕┐
│ Usuário: ${jogador.nick}
│ Cargo: Diretor NTEI
│ Permissão: Máxima
└───────────────────┘

╭━━━〔 💰 ECONOMIA GLOBAL 〕━━━╮
┃ 💸 /gastos
┃ 📈 /fluxocaixa
┃ 🪙 /economia-global
┃ 🏦 /banco-rpg
┃ 📊 /balanco
┃ 🧾 /transacoes
┃ 🚨 /fraudes
┃ 📋 /auditoria-financeira
┃ 🎁 /recompensas
┃ 💵 /impostos
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👤 JOGADORES 〕━━━╮
┃ 🔎 /perfil
┃ 📜 /historico
┃ 💰 /saldo
┃ 🎒 /inventario
┃ 📊 /estatisticas
┃ 🚫 /ban
┃ ♻️ /desban
┃ 🔇 /mute
┃ 🏅 /patentes
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 ⚔️ RPG CORE 〕━━━╮
┃ 💮 /elementos
┃ 🏮 /familias
┃ ⚔️ /armas
┃ 🩸 /habilidades
┃ 📈 /xp-global
┃ 🎯 /missoes
┃ 🏆 /ranking
┃ 🎲 /eventos
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🤖 SISTEMA 〕━━━╮
┃ 📡 /status
┃ 🔄 /backup
┃ 📁 /database
┃ 🧠 /ia
┃ 📋 /logs
┃ 🚨 /erros
┃ ♻️ /restart
┃ ☢️ /shutdown
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👑 ADMINISTRAÇÃO 〕━━━╮
┃ 👑 /admins
┃ 🔰 /promover
┃ ⛔ /rebaixar
┃ 📜 /permissoes
┃ 📊 /atividade-admin
┃ 🚨 /denuncias
┃ 🔒 /bloquear-comando
┃ 🔓 /liberar-comando
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🛰️ MONITORAMENTO 〕━━━╮
┃ 📈 /estatisticas-gerais
┃ 👥 /usuarios-online
┃ 🏦 /movimentacoes
┃ 💸 /gastos-hoje
┃ 📅 /relatorio-semanal
┃ 📋 /auditoria-completa
╰━━━━━━━━━━━━━━━━━━━━━━╯

⚠️ SISTEMA OPERACIONAL TANGERINA OS
⚠️ NÍVEL DE ACESSO: OMEGA` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: `❌ Senha OMEGA N.T.E.I Incorreta!` });
                    }
                    continue;
                }

                // ══════════════════════════════════════════
                //    MENU GERAL DE USUÁRIOS
                // ══════════════════════════════════════════
                if (cmd === '/menu' || cmd === '/ajuda' || cmd === '/start') {
                    let jogador = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender) || { nick: msg.pushName || 'Membro', ienes: 0, engrenagens: 0, nivel: 1 };
                    
                    await sock.sendMessage(remoteJid, { text:
`╭━━━〔 🍊 𝙏𝘼𝙉𝙂𝙀𝙍𝙄𝙉𝘼 𝘽𝙊𝙏 🍊 〕━━━╮
┃
┃ 👤 Usuário: ${jogador.nick}
┃ 🏮 Organização: Caçadores
┃ 💰 Ienes: ${jogador.ienes || 0}
┃ ⚙️ Engrenagens: ${jogador.engrenagens || 0}
┃ 📈 Nível: ${jogador.nivel || 1}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

╭─❖「 📚 CENTRAL 」❖─╮
│ 📜 /regras-sr
│ 📜 /regras-vt
│ 📜 /regras-basicas
│ ☸️ /regras-armas
│ ♋ /marca-cacador
│ 📅 /cronograma
╰─────────────────╯

╭─❖「 ⚔️ SISTEMAS 」❖─╮
│ 💮 /elementos
│ 👥 /familias
│ 🧾 /sistema-passe
│ 🤎 /passe-bronze
│ 🩶 /passe-prata
│ 🔰 /sistema-vip
╰─────────────────╯

╭─❖「 💰 ECONOMIA 」❖─╮
│ 🪙 /tabela-ienes
│ ⚙️ /tabela-engrenagens
│ 🪙 /loja-ienes
│ ⚙️ /loja-ferreiros
│ 🕋 /tabela-rs
│ 💮 /loja-rk
╰─────────────────╯

╭─❖「 📋 FICHAS 」❖─╮
│ 🏙️ /ficha-recrutamento
│ 🪙 /transferencia
│ 📛 /ficha-pontos
│ 🏦 /compras
│ 🔩 /ferreiros
╰─────────────────╯

╭─❖「 🌎 EXTRAS 」❖─╮
│ 🌎 /extra
╰─────────────────╯

> 🍊 Tangerina Bot © 2026
> ⚡ Powered By N.T.E.I` });
                    continue;
                }

                // ══════════════════════════════════════════
                //    PROCESSAMENTO AUTOMÁTICO DE RECRUTAMENTO
                // ══════════════════════════════════════════
                if (text.includes('RECRUTAMENTO APROVADO') || text.includes('Nick:') || text.includes('Nick Escolhido:')) {
                    const lines = text.split('\n');
                    const nick = extrairCampo(lines, 'Nick:', 'Nick Escolhido:');
                    
                    if (nick) {
                        let check = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
                        if (check) continue; // Ignora se já existir perfil

                        const maxId = db.prepare('SELECT MAX(id_rpg) as id FROM jogadores').get();
                        const novoId = (maxId?.id || 1002) + 1;

                        const familia = extrairCampo(lines, 'Família:', 'Familia:') || 'Tomioka';
                        const nacao = extrairCampo(lines, 'Nação:', 'Nacao:') || 'Aldeia do Norte';
                        const recrutador = extrairCampo(lines, 'Recrutador:') || 'Sistema';

                        db.prepare(`
                            INSERT INTO jogadores (jid, id_rpg, nick, raca, patente, familia, nacao, vila, recrutador, hp, max_hp, chakra, max_chakra, xp, ienes, engrenagens, nivel)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 100, 100, 100, 100, 0, 0, 0, 1)
                        `).run(sender, novoId, nick, 'Indefinida', '⏺️ Cidadão', familia, nacao, nacao, recrutador);

                        await sock.sendMessage(remoteJid, {
                            text: ` Harbinger do RPG!
➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
🤺 ᗂ ⛩️ Kimetsu New Age ⛩️ ᗃ 🤺

📃 RECRUTAMENTO APROVADO! 📃
_￫🆔◈ ID:  ⌊ ${novoId} ⌉_
_￫🧾◈ Nick:  ⌊ ${nick} ⌉_
_￫🧬◈ Raça:  ⌊ ❓ Indefinida ⌉_
_￫⛩️◈ Família:  ⌊ ${familia} ⌉_
_￫🏙️◈ Nação:  ⌊ ${nacao} ⌉_
_￫🔘◈ Patente:  ⌊ ⏺️ Cidadão ⌉_
_￫✒️◈ Recrutador:  ⌊ ${recrutador} ⌉_
➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
🍊 Bem-vindo(a) ao RPG, @${senderParam}!
Use */escolher raça Humano* ou */escolher raça Oni* para definir sua raça!
Ou digite */familias* para ver o catálogo de linhagens!`,
                            mentions: [sender]
                        });
                        continue;
                    }
                }

                // ══════════════════════════════════════════
                //    CATÁLOGO DE FAMÍLIAS & ESCOLHA
                // ══════════════════════════════════════════
                if (cmd === '/familias') {
                    await sock.sendMessage(remoteJid, { text:
`*➖᭄⎝ᯌ •➖• ஜ •⸨🌅⸩• ஜ •➖• ᯌ⎞➖᭄*
         _ᗂ ⛩️ Famílias Disponíveis ⛩️ ᗃ_

ᗂ🌅• Vila dos Ferreiros •🌅ᗃ
> Família Kanroji    ⃝💟
- Regenera 70%❤️ da vida do usuário.
> Família Tokito    ⃝♌
- Drena 10%🔹 de energia do oponente.

ᗂ🏙️• Vila dos Ferreiros •🏙️ᗃ
> Família Tomioka    ⃝☸️
- Aumenta 50%❤️/🔹 de vida e energia total do usuário.
> Família Kamado    ⃝🎴
- Aumenta 30%♦️ de dano em técnicas do usuário.

*➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄*

👉 Use */escolher familia [Nome]* para setar a sua.` });
                    continue;
                }

                if (cmd === '/escolher') {
                    const subOpcao = args[1]?.toLowerCase();
                    const valor = args.slice(2).join(' ');

                    let jogador = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
                    if (!jogador) {
                        await sock.sendMessage(remoteJid, { text: `❌ Registre-se primeiro enviando sua ficha aprovada!` });
                        continue;
                    }

                    if (subOpcao === 'raça' || subOpcao === 'raca') {
                        if (jogador.raca && jogador.raca !== 'Indefinida') {
                            await sock.sendMessage(remoteJid, { text: `❌ Você já escolheu sua raça como: *${jogador.raca}*!` });
                            continue;
                        }
                        const racaF = valor.toLowerCase() === 'oni' ? '👹 Oni' : (valor.toLowerCase() === 'humano' ? '👱‍♂️ Humano' : null);
                        if (!racaF) {
                            await sock.sendMessage(remoteJid, { text: `❌ Escolha inválida. Use:\n*/escolher raça Humano* ou */escolher raça Oni*` });
                            continue;
                        }
                        db.prepare('UPDATE jogadores SET raca = ? WHERE jid = ?').run(racaF, sender);
                        await sock.sendMessage(remoteJid, { text: `✅ Raça definida com sucesso como *${racaF}*!` });
                    } 
                    else if (subOpcao === 'familia' || subOpcao === 'família') {
                        const fams = ['Tomioka', 'Kamado', 'Kanroji', 'Tokito'];
                        const encontrada = fams.find(f => f.toLowerCase() === valor.toLowerCase());
                        if (!encontrada) {
                            await sock.sendMessage(remoteJid, { text: `❌ Família inválida! Escolha entre: Tomioka, Kamado, Kanroji ou Tokito.` });
                            continue;
                        }
                        db.prepare('UPDATE jogadores SET familia = ? WHERE jid = ?').run(encontrada, sender);
                        await sock.sendMessage(remoteJid, { text: `✅ Sua linhagem foi vinculada à família *${encontrada}* com sucesso!` });
                    }
                    continue;
                }

                // Execução de comandos padrões importados
                if (cmd === '/perfil') { await commandPerfil(sock, remoteJid, sender); continue; }
                if (cmd === '/loja') { await commandLoja(sock, remoteJid, 'IENES'); continue; }

            } catch (error) { console.error("Erro interno no loop:", error); }
        }
    });
}

connectToWhatsApp();
