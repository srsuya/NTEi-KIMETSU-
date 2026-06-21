
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';

// ════════════════════════════════════════════════
//                CONFIGURAÇÕES
// ════════════════════════════════════════════════
const OWNER_NUMBER = 'SEU_NUMERO_AQUI'; // Ex: 5511999999999
const PASSWORDS = { ADMIN: 'admin@2626', NTEI: 'ntei3010' };

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ════════════════════════════════════════════════
//             BANCO DE DADOS JSON
// ════════════════════════════════════════════════
const DB_FILES = {
    usuarios:    './db_usuarios.json',
    inventarios: './db_inventarios.json',
    lojas:       './db_lojas.json',
    logs:        './db_logs.json',
    placares:    './db_placares.json'
};

for (const path of Object.values(DB_FILES)) {
    if (!fs.existsSync(path)) fs.writeFileSync(path, JSON.stringify([], null, 2));
}

const load  = (key) => JSON.parse(fs.readFileSync(DB_FILES[key], 'utf-8'));
const save  = (key, data) => fs.writeFileSync(DB_FILES[key], JSON.stringify(data, null, 2));

// Sessões administrativas em memória
const sessions = new Map(); // sender -> 'admin' | 'ntei' | 'player'

// Anti-flood
const floodMap = new Map();
const FLOOD_LIMIT  = 8;
const FLOOD_WINDOW = 6000;
const FLOOD_BAN    = 5 * 60 * 1000;

// PLC em andamento: Map<groupJid, { jogador1, jogador2, turno, ... }>
const plcAtivo = new Map();

// ════════════════════════════════════════════════
//                  UTILITÁRIOS
// ════════════════════════════════════════════════
function checkFlood(sender) {
    const now = Date.now();
    const d = floodMap.get(sender);
    if (d?.banned && now < d.bannedUntil) return true;
    if (!d || now - d.start > FLOOD_WINDOW) {
        floodMap.set(sender, { count: 1, start: now, banned: false });
        return false;
    }
    d.count++;
    if (d.count >= FLOOD_LIMIT) {
        d.banned = true;
        d.bannedUntil = now + FLOOD_BAN;
        return true;
    }
    return false;
}

function extractText(msg) {
    const m = msg.message;
    if (!m) return '';
    const inner = m.ephemeralMessage?.message || m.viewOnceMessage?.message || m;
    return (
        inner.conversation ||
        inner.extendedTextMessage?.text ||
        inner.imageMessage?.caption ||
        inner.videoMessage?.caption || ''
    );
}

function getMentioned(msg) {
    return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

function getNivel(sender) {
    const num = sender.split('@')[0];
    if (num === OWNER_NUMBER) return 'ntei';
    return sessions.get(sender) || 'player';
}

function getDataHoje() {
    return new Date().toLocaleDateString('pt-BR');
}

function nextId(usuarios) {
    if (!usuarios.length) return '1001';
    const max = Math.max(...usuarios.map(u => parseInt(u.id) || 1000));
    return String(max + 1);
}

function addLog(tipo, descricao, autor) {
    const logs = load('logs');
    logs.push({ tipo, descricao, autor, data: getDataHoje(), hora: new Date().toLocaleTimeString('pt-BR') });
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    save('logs', logs);
}

// ════════════════════════════════════════════════
//               FICHAS FORMATADAS
// ════════════════════════════════════════════════
function fichaTransferencia(remetente, destinatario, valor, motivo) {
    return (
`➖᭄⎝ᯌ •➖• ஜ •⸨🎁⸩• ஜ •➖• ᯌ⎞➖᭄
 ᳃🎐ᘞ Ficha De Transferência ᘞ🎐᳃

_￫📅 ◈ Data: ⌊ ${getDataHoje()} ⌉_
_￫💸 ◈ Remetente: ⌊ ${remetente} ⌉_
_￫💱 ◈ Destinatário: ⌊ ${destinatario} ⌉_
_￫🎐 ◈ Valor: ⌊ ${valor}🎐 Fichas⌉_
_￫📄 ◈ Motivo: ⌊ ${motivo || 'Transferência direta'} ⌉_

➖᭄⎝ᯌ •➖• ஜ •⸨🎁⸩• ஜ •➖• ᯌ⎞➖᭄
𖠻↬✍🏻Ass:
*⌥ˁSuperiores☯️☪️*`
    );
}

function fichaCompra(item, comprador, valor) {
    return (
`➖᭄⎝ᯌ •➖• ஜ •⸨🎁⸩• ஜ •➖• ᯌ⎞➖᭄
᳃🎐ᘞ Ficha De Compras ᘞ🎐᳃

_￫📅 ◈ Data: ⌊ ${getDataHoje()} ⌉_
_￫🪪 ◈ Item: ⌊ ${item} ⌉_
_￫👤 ◈ Comprador: ⌊ ${comprador} ⌉_
_￫🎐 ◈ Valor: ⌊ ${valor}🎐 Fichas⌉_

➖᭄⎝ᯌ •➖• ஜ •⸨🎁⸩• ஜ •➖• ᯌ⎞➖᭄
𖠻↬✍🏻Ass:
*⌥ˁSuperiores☪️☯️ˁ⌥*`
    );
}

function fichaAnuncio(texto, assinatura) {
    return (
`*၍➖ಶ⚜️᪭➖ᯘ ୧📣୨ ᯘ➖᪭⚜️ಶ➖၍*
_భ❕〣 Anúncio Importante 〣❕భ_

_ႈ✒️༧ : ${texto}_

*၍➖ಶ⚜️᪭➖ᯘ ୧📣୨ ᯘ➖᪭⚜️ಶ➖၍*
𖠻↬✍🏻Ass:
*⌥ʕ${assinatura || 'Superiores☯️☪️🔆'}ʔ⌥*`
    );
}

function fichaPlc(p1, p2, data) {
    return (
`*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*
   _ಶ 🔆 ၍ Kimetsu New Age ၍ 🔆 ಶ_
      *႟⚔️୨ Placar De Lutas ୧🛡️႟*
          *⊢📆〣${data}〣📆⊣*

*၍👤ID: ${p1.id} | ${p1.nick} / ${p1.familia} / ${p1.patente}*
*❣️${p1.hp}/${p1.max_hp}⚡${p1.energia}/${p1.max_energia}*
🆚
*၍👤ID: ${p2.id} | ${p2.nick} / ${p2.familia} / ${p2.patente}*
*❣️${p2.hp}/${p2.max_hp}⚡${p2.energia}/${p2.max_energia}*

*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*
𖠻↬✍🏻Ass:
*⌥ʕBy NTEi🛜ʔ⌥*`
    );
}

// ════════════════════════════════════════════════
//                  MENUS
// ════════════════════════════════════════════════
const MENU_USER = (u) =>
`╭━━━〔 🍊 𝙏𝘼𝙉𝙂𝙀𝙍𝙄𝙉𝘼 𝘽𝙊𝙏 🍊 〕━━━╮
┃
┃ 👤 Usuário: ${u.nick}
┃ 🏮 Organização: ${u.organizacao}
┃ 💰 Ienes: ${u.ienes}
┃ ⚙️ Fichas: ${u.fichas}
┃ 📈 Nível: ${u.nivel}
┃ 🆔 ID: #${u.id}
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
│ 🪙 /transferir [ID] [valor]
│ 📛 /ficha-pontos
│ 🏦 /compras
│ 🔩 /ferreiros
│ 🎒 /inventario
╰─────────────────╯

╭─❖「 🌎 EXTRAS 」❖─╮
│ 🌎 /extra
│ 🆔 /lista-ids
│ 👤 /perfil
╰─────────────────╯

> 🍊 Tangerina Bot © 2026
> ⚡ Powered By N.T.E.I`;

const MENU_ADMIN =
`╭════════════════════════╗
│      👑 PAINEL ADMIN    │
╰════════════════════════╯

╭━━━〔 👥 USUÁRIOS 〕━━━╮
┃ 🔍 /buscar [ID ou Nick]
┃ 📜 /historico [ID]
┃ ⚠️ /advertir @user [motivo]
┃ 🚫 /ban @user
┃ ♻️ /desban @user
┃ 🔇 /mute @user
┃ 🔊 /unmute @user
┃ 🧹 /limpar-ficha [ID]
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 💰 ECONOMIA 〕━━━╮
┃ 🪙 /add-ienes [ID] [valor]
┃ 🪙 /rm-ienes [ID] [valor]
┃ ⚙️ /add-fichas [ID] [valor]
┃ ⚙️ /rm-fichas [ID] [valor]
┃ 🎁 /bonus [ID] [valor]
┃ 🧾 /extrato [ID]
┃ 💸 /gastos
┃ 📊 /saldo-geral
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🏪 LOJAS 〕━━━╮
┃ ➕ /criar-loja [nome]
┃ ➕ /add-item [loja] | [item] | [preço]
┃ ➖ /rm-item [loja] | [item]
┃ 💰 /alterar-preco [loja] | [item] | [preço]
┃ 📦 /estoque [loja]
┃ 🏪 /ver-loja [loja]
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 ⚔️ RPG 〕━━━╮
┃ 🎯 /criar-missao [desc]
┃ 🎲 /evento [desc]
┃ 🏆 /ranking
┃ 📈 /add-xp [ID] [valor]
┃ 📉 /rm-xp [ID] [valor]
┃ 🏮 /set-patente [ID] [patente]
┃ ⚔️ /plc [ID1] [ID2]
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 📊 RELATÓRIOS 〕━━━╮
┃ 📋 /logs
┃ 📈 /atividade
┃ 💰 /movimentacoes
┃ 👥 /lista-ids
┃ 📣 /anuncio [texto]
╰━━━━━━━━━━━━━━━━━━╯`;

const MENU_NTEI = (nick) =>
`╭═══════════════════════════════╮
│           ☢️ N.T.E.I ☢️         │
│  NÚCLEO TECNOLÓGICO ESTRATÉGICO │
│            IMPERIAL            │
╰═══════════════════════════════╯

┌〔 🔴 ACESSO OMEGA 〕┐
│ Usuário: ${nick}
│ Cargo: Diretor NTEI
│ Permissão: Máxima
└───────────────────┘

╭━━━〔 💰 ECONOMIA GLOBAL 〕━━━╮
┃ 💸 /gastos
┃ 📈 /fluxo-caixa
┃ 🪙 /economia-global
┃ 📊 /saldo-geral
┃ 🧾 /movimentacoes
┃ 🚨 /fraudes
┃ 📋 /auditoria
┃ 🎁 /bonus [ID] [valor]
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👤 JOGADORES 〕━━━╮
┃ 🔎 /perfil
┃ 📜 /historico [ID]
┃ 💰 /saldo [ID]
┃ 🎒 /inventario
┃ 📊 /lista-ids
┃ 🚫 /ban @user
┃ ♻️ /desban @user
┃ 🏅 /set-patente [ID] [patente]
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 ⚔️ RPG CORE 〕━━━╮
┃ 💮 /elementos
┃ 🏮 /familias
┃ 📈 /add-xp [ID] [valor]
┃ 📉 /rm-xp [ID] [valor]
┃ 🎯 /criar-missao [desc]
┃ 🏆 /ranking
┃ 🎲 /eventos
┃ ⚔️ /plc [ID1] [ID2]
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🤖 SISTEMA 〕━━━╮
┃ 📡 /ping
┃ 📋 /logs
┃ 🚨 /erros
┃ 📊 /stats
┃ 📣 /broadcast [msg]
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👑 ADMINISTRAÇÃO 〕━━━╮
┃ 👑 /add-admin @user
┃ ⛔ /rm-admin @user
┃ 📜 /lista-admins
┃ 🔒 /bloquear [comando]
┃ 🔓 /liberar [comando]
╰━━━━━━━━━━━━━━━━━━━━━━╯

⚠️ SISTEMA OPERACIONAL TANGERINA OS
⚠️ NÍVEL DE ACESSO: OMEGA`;

// ════════════════════════════════════════════════
//                 CONEXÃO PRINCIPAL
// ════════════════════════════════════════════════
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const makeSocket = makeWASocket.default || makeWASocket;

    const sock = makeSocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        getMessage: async () => ({ conversation: '' })
    });

    sock.ev.on('creds.update', saveCreds);

    if (!sock.authState.creds.registered) {
        console.log('\n🍊 [Tangerina-Bot] Aguardando estabilização... (10s)\n');
        await delay(10000);
        let phone = await question('Número do bot (Ex: 5511999999999): ');
        phone = phone.replace(/\D/g, '');
        if (phone) {
            try {
                await delay(2000);
                let code = await sock.requestPairingCode(phone);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 CÓDIGO: \x1b[32m${code}\x1b[0m\n`);
                console.log('WhatsApp → Aparelhos Conectados → Conectar com número\n');
            } catch (e) {
                console.error('Erro ao gerar código. Rode npm start novamente.');
            }
        }
    }

    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') console.log('🍊 Tangerina Bot conectado!');
        if (connection === 'close') {
            const should = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (should) connectToWhatsApp();
        }
    });

    // ════════════════════════════════════════════
    //            HANDLER DE MENSAGENS
    // ════════════════════════════════════════════
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.message || msg.key.fromMe) continue;

                const remoteJid = msg.key.remoteJid;
                const sender    = msg.key.participant || remoteJid;
                const text      = extractText(msg).trim();
                if (!text) continue;

                const nivel = getNivel(sender);

                // Anti-flood (apenas players)
                if (nivel === 'player' && checkFlood(sender)) continue;

                const low  = text.toLowerCase();
                const args = text.split(/\s+/);
                const cmd  = args[0].toLowerCase();

                let usuarios = load('usuarios');
                let user     = usuarios.find(u => u.numero === sender);

                // ── Helpers inline ──
                const reply = (t) => sock.sendMessage(remoteJid, { text: t });
                const replyM = (t) => sock.sendMessage(remoteJid, { text: t, mentions: [sender] });
                const isAdmin = nivel === 'admin' || nivel === 'ntei';

                // ══════════════════════════════════════════
                //  AUTENTICAÇÃO DE SESSÃO ADMIN / NTEI
                // ══════════════════════════════════════════
                if (cmd === '/admin') {
                    if (args[1] === PASSWORDS.ADMIN) {
                        sessions.set(sender, 'admin');
                        await reply('👑 Sessão Admin iniciada! Use /menuadmin para gerenciar.');
                    } else {
                        await reply('❌ Senha incorreta. Uso: `/admin admin@2626`');
                    }
                    continue;
                }

                if (cmd === '/ntei-login') {
                    if (args[1] === PASSWORDS.NTEI) {
                        sessions.set(sender, 'ntei');
                        await reply('☢️ Autenticação OMEGA concedida! Use /menuntei.');
                    } else {
                        await reply('❌ Senha incorreta. Uso: `/ntei-login ntei3010`');
                    }
                    continue;
                }

                if (cmd === '/logout') {
                    sessions.delete(sender);
                    await reply('🔓 Sessão encerrada.');
                    continue;
                }

                // ══════════════════════════════════════════
                //  MENUS
                // ══════════════════════════════════════════
                if (cmd === '/menu' || cmd === '/start') {
                    if (!user) {
                        await reply('❌ Você ainda não tem ficha! Envie sua ficha de recrutamento.');
                        continue;
                    }
                    await reply(MENU_USER(user));
                    continue;
                }

                if (cmd === '/menuadmin') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    await reply(MENU_ADMIN);
                    continue;
                }

                if (cmd === '/menuntei') {
                    if (nivel !== 'ntei') { await reply('❌ Restrito ao dono do sistema.'); continue; }
                    await reply(MENU_NTEI(user?.nick || 'Diretor'));
                    continue;
                }

                // ══════════════════════════════════════════
                //  PING
                // ══════════════════════════════════════════
                if (cmd === '/ping') {
                    const t = Date.now();
                    await reply(`🏓 Pong! ${Date.now() - t}ms — 🍊 Tangerina Bot Online`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  FICHA DE RECRUTAMENTO (detecção automática)
                // ══════════════════════════════════════════
                if (text.toLowerCase().includes('recrutamento') && text.includes('Nick')) {
                    if (user) {
                        await replyM(`⚠️ @${sender.split('@')[0]} você já tem cadastro! ID #${user.id}`);
                        continue;
                    }

                    const lines = text.split('\n');
                    const extrair = (...termos) => {
                        for (const t of termos) {
                            const l = lines.find(x => x.toLowerCase().includes(t.toLowerCase()));
                            if (l) {
                                const partes = l.split(/[:\⌊\⌉]/);
                                for (let i = partes.length - 1; i >= 0; i--) {
                                    const v = partes[i].replace(/[⌊⌉◈￫🆔🧾⛩️🏙️🔘✒️\*_]/g, '').trim();
                                    if (v) return v;
                                }
                            }
                        }
                        return null;
                    };

                    const nick      = extrair('Nick Escolhido', 'Nick:') || msg.pushName || 'Sem Nome';
                    const familia   = extrair('Família:', 'Familia:') || 'Nenhuma';
                    const nacao     = extrair('Nação:', 'Vila:', 'Aldeia:') || 'Indefinida';
                    const patente   = extrair('Patente:') || '⏺️ Cidadão';
                    const recrutador = extrair('Recrutador:') || 'Sistema';

                    const novoId = nextId(usuarios);
                    const novoUser = {
                        id: novoId,
                        nick,
                        numero: sender,
                        organizacao: 'Indefinida',
                        patente,
                        raca: '❓ Indefinida',
                        familia,
                        vila: nacao,
                        recrutador,
                        ienes: 0,
                        fichas: 0,
                        xp: 0,
                        nivel: 1,
                        hp: 200,
                        max_hp: 200,
                        energia: 400,
                        max_energia: 400,
                        banido: false,
                        mutado: false,
                        advertencias: 0
                    };

                    usuarios.push(novoUser);
                    save('usuarios', usuarios);
                    addLog('RECRUTAMENTO', `${nick} (ID ${novoId}) recrutado por ${recrutador}`, sender);

                    await sock.sendMessage(remoteJid, {
                        text:
`➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
🤺 ᗂ ⛩️ Kimetsu New Age ⛩️ ᗃ 🤺
    📃 RECRUTAMENTO APROVADO! 📃

_￫🆔◈ ID:  ⌊ ${novoId} ⌉_
_￫🧾◈ Nick:  ⌊ ${nick} ⌉_
_￫🧬◈ Raça:  ⌊ ❓ Indefinida ⌉_
_￫⛩️◈ Família:  ⌊ ${familia} ⌉_
_￫🏙️◈ Nação:  ⌊ ${nacao} ⌉_
_￫🔘◈ Patente:  ⌊ ${patente} ⌉_
_￫✒️◈ Recrutador:  ⌊ ${recrutador} ⌉_

➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
🍊 Bem-vindo(a) ao RPG, @${sender.split('@')[0]}!
Use */escolher raça Humano* ou */escolher raça Oni*`,
                        mentions: [sender]
                    });
                    continue;
                }

                // ══════════════════════════════════════════
                //  ESCOLHER RAÇA
                // ══════════════════════════════════════════
                if (low.startsWith('/escolher raça') || low.startsWith('/escolher raca')) {
                    if (!user) { await reply('❌ Você não tem ficha cadastrada.'); continue; }
                    if (user.raca && user.raca !== '❓ Indefinida') {
                        await reply(`❌ Raça já definida: *${user.raca}*. Peça a um admin para alterar.`);
                        continue;
                    }
                    const racaEsc = text.replace(/\/escolher\s+ra[çc]a\s*/i, '').trim().toLowerCase();
                    const racas = { humano: '👱 Humano', oni: '👹 Oni' };
                    const racaFinal = racas[racaEsc];
                    if (!racaFinal) {
                        await reply('❌ Raça inválida! Use:\n*/escolher raça Humano*\n*/escolher raça Oni*');
                        continue;
                    }
                    user.raca = racaFinal;
                    user.organizacao = racaEsc === 'humano' ? '⚔️ Caçadores' : '👹 Onis';
                    save('usuarios', usuarios);
                    await replyM(`✅ @${sender.split('@')[0]} raça definida: *${racaFinal}*! Use /perfil para ver.`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  PERFIL
                // ══════════════════════════════════════════
                if (cmd === '/perfil') {
                    if (!user) { await reply('❌ Você não tem ficha cadastrada.'); continue; }
                    await reply(
`🍊 *STATUS DO GUERREIRO* 🍊
━━━━━━━━━━━━━━━━━━━━━━
👤 *Nick:* ${user.nick}
🆔 *ID RPG:* #${user.id}
🧬 *Raça:* ${user.raca}
🎖️ *Patente:* ${user.patente}
🏡 *Vila:* ${user.vila}
🧑‍🤝‍🧑 *Família:* ${user.familia}
🏮 *Organização:* ${user.organizacao}
━━━━━━━━━━━━━━━━━━━━━━
🩸 *HP:* [ ${user.hp} / ${user.max_hp} ]
⚡ *Energia:* [ ${user.energia} / ${user.max_energia} ]
✨ *XP:* ${user.xp}  |  📈 *Nível:* ${user.nivel}
━━━━━━━━━━━━━━━━━━━━━━
💰 *FINANÇAS*
🪙 *Ienes:* ${user.ienes}
🎐 *Fichas:* ${user.fichas}
━━━━━━━━━━━━━━━━━━━━━━
🎒 /inventario  |  📋 /menu`
                    );
                    continue;
                }

                // ══════════════════════════════════════════
                //  SALVAR INVENTÁRIO
                // ══════════════════════════════════════════
                if (low.startsWith('/salvar inventário') || low.startWith('/salvar inventario')) {
                    if (!user) { await reply('❌ Cadastre-se primeiro.'); continue; }
                    const conteudo = text.replace(/\/salvar\s+invent[aá]rio\s*/i, '').trim();
                    if (!conteudo) {
                        await reply('❌ Uso: `/salvar inventário [texto do seu inventário]`');
                        continue;
                    }
                    let invs = load('inventarios');
                    invs = invs.filter(i => i.id !== user.id);
                    invs.push({ id: user.id, nick: user.nick, dados: conteudo, atualizado: getDataHoje() });
                    save('inventarios', invs);
                    await reply('🎒 Inventário salvo com sucesso! Use /inventario para consultar.');
                    continue;
                }

                if (cmd === '/inventario' || cmd === '/inventário') {
                    if (!user) { await reply('❌ Cadastre-se primeiro.'); continue; }
                    const invs = load('inventarios');
                    const inv  = invs.find(i => i.id === user.id);
                    if (!inv) {
                        await reply('🎒 Inventário vazio. Use `/salvar inventário + texto` para registrar.');
                    } else {
                        await reply(`🎒 *INVENTÁRIO — ${user.nick} (ID #${user.id})*\n📅 Atualizado: ${inv.atualizado}\n\n${inv.dados}`);
                    }
                    continue;
                }

                // ══════════════════════════════════════════
                //  LISTA DE IDs
                // ══════════════════════════════════════════
                if (cmd === '/lista-ids') {
                    if (!usuarios.length) { await reply('Nenhum usuário cadastrado.'); continue; }
                    let str = '📋 *RELAÇÃO GLOBAL DE IDs:*\n\n';
                    usuarios.forEach(u => {
                        str += `🆔 #${u.id} | *${u.nick}* | ${u.raca} | ${u.patente}\n`;
                    });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  TRANSFERIR (por ID)
                //  Uso: /transferir 1001 1500 [motivo opcional]
                // ══════════════════════════════════════════
                if (cmd === '/transferir') {
                    if (!user) { await reply('❌ Você não tem ficha cadastrada.'); continue; }
                    const destId = args[1];
                    const valor  = parseInt(args[2]);
                    const motivo = args.slice(3).join(' ') || 'Transferência direta';

                    if (!destId || isNaN(valor) || valor <= 0) {
                        await reply('❌ Uso: `/transferir [ID] [valor] [motivo opcional]`\nEx: `/transferir 1001 1500 Pagamento de missão`');
                        continue;
                    }
                    if (user.fichas < valor) {
                        await reply(`❌ Fichas insuficientes! Você tem: 🎐 ${user.fichas}`);
                        continue;
                    }
                    const dest = usuarios.find(u => u.id === destId);
                    if (!dest) {
                        await reply(`❌ ID #${destId} não encontrado. Use /lista-ids para consultar.`);
                        continue;
                    }
                    if (dest.numero === sender) {
                        await reply('❌ Você não pode transferir para si mesmo!');
                        continue;
                    }

                    user.fichas -= valor;
                    dest.fichas += valor;
                    save('usuarios', usuarios);
                    addLog('TRANSFERENCIA', `${user.nick} (${user.id}) → ${dest.nick} (${dest.id}): ${valor} fichas | ${motivo}`, sender);

                    await reply(fichaTransferencia(user.nick, dest.nick, valor, motivo));
                    continue;
                }

                // ══════════════════════════════════════════
                //  BUSCAR (admin)
                // ══════════════════════════════════════════
                if (cmd === '/buscar') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const termo = args.slice(1).join(' ');
                    if (!termo) { await reply('❌ Uso: `/buscar [ID ou Nick]`'); continue; }
                    const found = usuarios.filter(u =>
                        u.id === termo || u.nick.toLowerCase().includes(termo.toLowerCase())
                    );
                    if (!found.length) { await reply('❌ Nenhum usuário encontrado.'); continue; }
                    let str = '🔍 *RESULTADO DA BUSCA:*\n\n';
                    found.forEach(u => {
                        str += `🆔 #${u.id} | *${u.nick}* | ${u.raca} | ${u.patente} | 🪙${u.ienes} | 🎐${u.fichas}\n`;
                    });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  SALDO DE JOGADOR ESPECÍFICO (admin)
                //  /saldo [ID]
                // ══════════════════════════════════════════
                if (cmd === '/saldo') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const targetId = args[1];
                    const t = usuarios.find(u => u.id === targetId);
                    if (!t) { await reply(`❌ ID #${targetId} não encontrado.`); continue; }
                    await reply(`💰 *Saldo de ${t.nick} (ID #${t.id})*\n🪙 Ienes: ${t.ienes}\n🎐 Fichas: ${t.fichas}`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ADD / RM IENES (admin)
                // ══════════════════════════════════════════
                if (cmd === '/add-ienes') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n) || n <= 0) { await reply('❌ Uso: `/add-ienes [ID] [valor]`'); continue; }
                    t.ienes += n;
                    save('usuarios', usuarios);
                    addLog('ADD-IENES', `+${n} ienes para ${t.nick} (${t.id})`, sender);
                    await reply(`✅ Adicionado 🪙 ${n} Ienes para *${t.nick}* (ID #${id}). Total: ${t.ienes}`);
                    continue;
                }

                if (cmd === '/rm-ienes') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n) || n <= 0) { await reply('❌ Uso: `/rm-ienes [ID] [valor]`'); continue; }
                    t.ienes = Math.max(0, t.ienes - n);
                    save('usuarios', usuarios);
                    addLog('RM-IENES', `-${n} ienes de ${t.nick} (${t.id})`, sender);
                    await reply(`⚠️ Removido 🪙 ${n} Ienes de *${t.nick}* (ID #${id}). Saldo: ${t.ienes}`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ADD / RM FICHAS (admin)
                // ══════════════════════════════════════════
                if (cmd === '/add-fichas') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n) || n <= 0) { await reply('❌ Uso: `/add-fichas [ID] [valor]`'); continue; }
                    t.fichas += n;
                    save('usuarios', usuarios);
                    addLog('ADD-FICHAS', `+${n} fichas para ${t.nick} (${t.id})`, sender);
                    await reply(`✅ Adicionado 🎐 ${n} Fichas para *${t.nick}* (ID #${id}). Total: ${t.fichas}`);
                    continue;
                }

                if (cmd === '/rm-fichas') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n) || n <= 0) { await reply('❌ Uso: `/rm-fichas [ID] [valor]`'); continue; }
                    t.fichas = Math.max(0, t.fichas - n);
                    save('usuarios', usuarios);
                    addLog('RM-FICHAS', `-${n} fichas de ${t.nick} (${t.id})`, sender);
                    await reply(`⚠️ Removido 🎐 ${n} Fichas de *${t.nick}* (ID #${id}). Saldo: ${t.fichas}`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  BONUS (admin) — adiciona ienes + fichas
                // ══════════════════════════════════════════
                if (cmd === '/bonus') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n) || n <= 0) { await reply('❌ Uso: `/bonus [ID] [valor]`'); continue; }
                    t.ienes  += n;
                    t.fichas += n;
                    save('usuarios', usuarios);
                    addLog('BONUS', `Bônus ${n} para ${t.nick} (${t.id})`, sender);
                    await reply(`🎁 Bônus de 🪙${n} Ienes + 🎐${n} Fichas para *${t.nick}* (ID #${id})!`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  EXTRATO (admin)
                // ══════════════════════════════════════════
                if (cmd === '/extrato') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const targetId = args[1];
                    const logs = load('logs').filter(l =>
                        l.descricao?.includes(`(${targetId})`) || l.descricao?.includes(`#${targetId}`)
                    ).slice(-10);
                    if (!logs.length) { await reply('Nenhum registro encontrado para este ID.'); continue; }
                    let str = `🧾 *EXTRATO — ID #${targetId}:*\n\n`;
                    logs.forEach(l => { str += `📌 [${l.data}] *${l.tipo}* → ${l.descricao}\n`; });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  SALDO GERAL (admin)
                // ══════════════════════════════════════════
                if (cmd === '/saldo-geral') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const totalIenes  = usuarios.reduce((a, u) => a + u.ienes, 0);
                    const totalFichas = usuarios.reduce((a, u) => a + u.fichas, 0);
                    await reply(
`📊 *SALDO GERAL DO RPG*
━━━━━━━━━━━━━━━━
👤 Jogadores: ${usuarios.length}
🪙 Total Ienes: ${totalIenes}
🎐 Total Fichas: ${totalFichas}
━━━━━━━━━━━━━━━━`
                    );
                    continue;
                }

                // ══════════════════════════════════════════
                //  MOVIMENTAÇÕES (admin)
                // ══════════════════════════════════════════
                if (cmd === '/movimentacoes') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const logs = load('logs').slice(-15);
                    if (!logs.length) { await reply('Nenhuma movimentação registrada.'); continue; }
                    let str = '💰 *ÚLTIMAS MOVIMENTAÇÕES:*\n\n';
                    logs.forEach(l => { str += `[${l.data} ${l.hora}] *${l.tipo}* — ${l.descricao}\n`; });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  LOGS (admin)
                // ══════════════════════════════════════════
                if (cmd === '/logs') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const logs = load('logs').slice(-10);
                    if (!logs.length) { await reply('Nenhum log encontrado.'); continue; }
                    let str = '📋 *LOGS DO SISTEMA (últimos 10):*\n\n';
                    logs.forEach(l => { str += `[${l.data} ${l.hora}] *${l.tipo}* → ${l.descricao}\n`; });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  SET PATENTE (admin)
                // ══════════════════════════════════════════
                if (cmd === '/set-patente' || cmd === '/alterar-patente') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, ...patp] = args;
                    const pat = patp.join(' ');
                    const t   = usuarios.find(u => u.id === id);
                    if (!t || !pat) { await reply('❌ Uso: `/set-patente [ID] [nova patente]`'); continue; }
                    const velha = t.patente;
                    t.patente = pat;
                    save('usuarios', usuarios);
                    addLog('PATENTE', `${t.nick} (${t.id}): ${velha} → ${pat}`, sender);
                    await reply(`🏅 Patente de *${t.nick}* (ID #${id}) alterada para *${pat}*!`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ADD/RM XP (admin)
                // ══════════════════════════════════════════
                if (cmd === '/add-xp') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n)) { await reply('❌ Uso: `/add-xp [ID] [valor]`'); continue; }
                    t.xp += n;
                    // Nível sobe a cada 1000 XP
                    t.nivel = Math.floor(t.xp / 1000) + 1;
                    save('usuarios', usuarios);
                    await reply(`✅ +${n} XP para *${t.nick}*. Total: ${t.xp} XP | Nível: ${t.nivel}`);
                    continue;
                }

                if (cmd === '/rm-xp') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id, val] = args;
                    const n = parseInt(val);
                    const t = usuarios.find(u => u.id === id);
                    if (!t || isNaN(n)) { await reply('❌ Uso: `/rm-xp [ID] [valor]`'); continue; }
                    t.xp = Math.max(0, t.xp - n);
                    t.nivel = Math.floor(t.xp / 1000) + 1;
                    save('usuarios', usuarios);
                    await reply(`⚠️ -${n} XP de *${t.nick}*. Total: ${t.xp} XP | Nível: ${t.nivel}`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  RANKING (público)
                // ══════════════════════════════════════════
                if (cmd === '/ranking') {
                    const sorted = [...usuarios].sort((a, b) => b.xp - a.xp).slice(0, 10);
                    if (!sorted.length) { await reply('Sem dados para ranking.'); continue; }
                    let str = '🏆 *RANKING DE XP — TOP 10*\n━━━━━━━━━━━━━━━━\n';
                    sorted.forEach((u, i) => {
                        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                        str += `${medal} *${u.nick}* (ID #${u.id}) — ✨ ${u.xp} XP | Nv.${u.nivel}\n`;
                    });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ANÚNCIO (admin)
                //  Uso: /anuncio [texto] | [assinatura opcional]
                // ══════════════════════════════════════════
                if (cmd === '/anuncio') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const resto = text.replace(/\/anuncio\s*/i, '');
                    const partes = resto.split('|');
                    const textAnuncio = partes[0]?.trim();
                    const assinatura  = partes[1]?.trim() || 'Superiores☯️☪️🔆';
                    if (!textAnuncio) { await reply('❌ Uso: `/anuncio [texto] | [assinatura]`'); continue; }
                    await reply(fichaAnuncio(textAnuncio, assinatura));
                    continue;
                }

                // ══════════════════════════════════════════
                //  LOJA — CRIAR (admin)
                //  /criar-loja [nome da loja]
                // ══════════════════════════════════════════
                if (cmd === '/criar-loja') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const nomeLoja = args.slice(1).join(' ');
                    if (!nomeLoja) { await reply('❌ Uso: `/criar-loja [nome]`'); continue; }
                    let lojas = load('lojas');
                    if (lojas.find(l => l.nome.toLowerCase() === nomeLoja.toLowerCase())) {
                        await reply(`❌ Loja *${nomeLoja}* já existe!`);
                        continue;
                    }
                    lojas.push({ nome: nomeLoja, itens: [], criado: getDataHoje() });
                    save('lojas', lojas);
                    await reply(`✅ Loja *${nomeLoja}* criada com sucesso! Use /add-item para adicionar produtos.`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  LOJA — ADD ITEM (admin)
                //  /add-item [loja] | [item] | [preço]
                // ══════════════════════════════════════════
                if (cmd === '/add-item') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const resto  = text.replace(/\/add-item\s*/i, '');
                    const partes = resto.split('|').map(s => s.trim());
                    if (partes.length < 3) { await reply('❌ Uso: `/add-item [loja] | [item] | [preço]`'); continue; }
                    const [nomeLoja, nomeItem, precoStr] = partes;
                    const preco = parseInt(precoStr);
                    if (isNaN(preco)) { await reply('❌ Preço inválido.'); continue; }
                    let lojas = load('lojas');
                    const loja = lojas.find(l => l.nome.toLowerCase() === nomeLoja.toLowerCase());
                    if (!loja) { await reply(`❌ Loja *${nomeLoja}* não encontrada. Use /criar-loja primeiro.`); continue; }
                    loja.itens.push({ nome: nomeItem, preco, estoque: 99 });
                    save('lojas', lojas);
                    await reply(`✅ Item *${nomeItem}* (🎐 ${preco}) adicionado à loja *${loja.nome}*!`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  LOJA — REMOVER ITEM (admin)
                //  /rm-item [loja] | [item]
                // ══════════════════════════════════════════
                if (cmd === '/rm-item') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const resto  = text.replace(/\/rm-item\s*/i, '');
                    const partes = resto.split('|').map(s => s.trim());
  if (partes.length < 2) { await reply('❌ Uso: `/rm-item [loja] | [item]`'); continue; }
                    const [nomeLoja, nomeItem] = partes;
                    let lojas = load('lojas');
                    const loja = lojas.find(l => l.nome.toLowerCase() === nomeLoja.toLowerCase());
                    if (!loja) { await reply(`❌ Loja *${nomeLoja}* não encontrada.`); continue; }
                    const antes = loja.itens.length;
                    loja.itens = loja.itens.filter(i => !i.nome.toLowerCase().includes(nomeItem.toLowerCase()));
                    if (loja.itens.length === antes) { await reply(`❌ Item *${nomeItem}* não encontrado.`); continue; }
                    save('lojas', lojas);
                    await reply(`✅ Item *${nomeItem}* removido da loja *${loja.nome}*!`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  LOJA — ALTERAR PREÇO (admin)
                //  /alterar-preco [loja] | [item] | [novo preço]
                // ══════════════════════════════════════════
                if (cmd === '/alterar-preco') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const resto  = text.replace(/\/alterar-preco\s*/i, '');
                    const partes = resto.split('|').map(s => s.trim());
                    if (partes.length < 3) { await reply('❌ Uso: `/alterar-preco [loja] | [item] | [novo preço]`'); continue; }
                    const [nomeLoja, nomeItem, precoStr] = partes;
                    const novoPreco = parseInt(precoStr);
                    if (isNaN(novoPreco)) { await reply('❌ Preço inválido.'); continue; }
                    let lojas = load('lojas');
                    const loja = lojas.find(l => l.nome.toLowerCase() === nomeLoja.toLowerCase());
                    if (!loja) { await reply(`❌ Loja *${nomeLoja}* não encontrada.`); continue; }
                    const item = loja.itens.find(i => i.nome.toLowerCase().includes(nomeItem.toLowerCase()));
                    if (!item) { await reply(`❌ Item *${nomeItem}* não encontrado.`); continue; }
                    const velho = item.preco;
                    item.preco = novoPreco;
                    save('lojas', lojas);
                    await reply(`✅ Preço de *${item.nome}* atualizado: 🎐 ${velho} → 🎐 ${novoPreco}`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  LOJA — VER / CONSULTAR (público)
                //  /ver-loja [nome] ou /loja [nome]
                // ══════════════════════════════════════════
                if (cmd === '/ver-loja' || cmd === '/loja') {
                    const nomeLoja = args.slice(1).join(' ');
                    const lojas = load('lojas');
                    if (!nomeLoja) {
                        if (!lojas.length) { await reply('Nenhuma loja disponível.'); continue; }
                        let str = '🏪 *LOJAS DISPONÍVEIS:*\n\n';
                        lojas.forEach(l => { str += `🏪 *${l.nome}* — ${l.itens.length} item(s)\n`; });
                        str += '\nUse `/ver-loja [nome]` para ver os itens.';
                        await reply(str);
                        continue;
                    }
                    const loja = lojas.find(l => l.nome.toLowerCase().includes(nomeLoja.toLowerCase()));
                    if (!loja) { await reply(`❌ Loja *${nomeLoja}* não encontrada.`); continue; }
                    if (!loja.itens.length) { await reply(`🏪 Loja *${loja.nome}* está vazia.`); continue; }

                    let str =
`*႟ •➖ ᯘ• 🎁 •భ ⸨ 🎐 ⸩ భ• 🎁 •ᯘ ➖• ႟*
   _◈ ᗂ  🎐ᡉ ${loja.nome}ᡉ🎐 ᗃ ◈_

*ৈ🎐ᑐ Cards Da Loja:*\n\n`;
                    loja.itens.forEach(i => {
                        str += `_⟆⟅ ${i.nome}_\n     _「 ${i.preco}🎐 Fichas 」_\n\n`;
                    });
                    str += `*႟ •➖ ᯘ• 🎁 •భ ⸨ 🎐 ⸩ భ• 🎁 •ᯘ ➖• ႟*\n𖠻↬✍🏻Ass:\n*⌥ʕ☪️☯️' Superiores '♠️⚜️ʔ⌥*`;
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ESTOQUE (admin)
                // ══════════════════════════════════════════
                if (cmd === '/estoque') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const nomeLoja = args.slice(1).join(' ');
                    const lojas = load('lojas');
                    const loja = nomeLoja
                        ? lojas.find(l => l.nome.toLowerCase().includes(nomeLoja.toLowerCase()))
                        : null;
                    if (nomeLoja && !loja) { await reply(`❌ Loja *${nomeLoja}* não encontrada.`); continue; }
                    const alvo = loja ? [loja] : lojas;
                    let str = '📦 *ESTOQUE GERAL:*\n\n';
                    alvo.forEach(l => {
                        str += `🏪 *${l.nome}:*\n`;
                        if (!l.itens.length) { str += '  (vazio)\n'; return; }
                        l.itens.forEach(i => { str += `  • ${i.nome} — 🎐 ${i.preco} | Estoque: ${i.estoque}\n`; });
                        str += '\n';
                    });
                    await reply(str);
                    continue;
                }

                // ══════════════════════════════════════════
                //  PLC — PLACAR DE LUTA (admin)
                //  /plc [ID1] [ID2]
                // ══════════════════════════════════════════
                if (cmd === '/plc') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const [, id1, id2] = args;
                    const p1 = usuarios.find(u => u.id === id1);
                    const p2 = usuarios.find(u => u.id === id2);
                    if (!p1 || !p2) {
                        await reply('❌ Um ou ambos os IDs não encontrados.\nUso: `/plc [ID1] [ID2]`');
                        continue;
                    }

                    // Clona HP/Energia para a batalha
                    const estado = {
                        p1: { ...p1, hp_atual: p1.hp, en_atual: p1.energia },
                        p2: { ...p2, hp_atual: p2.hp, en_atual: p2.energia },
                        turno: p1.numero,
                        grupo: remoteJid
                    };
                    plcAtivo.set(remoteJid, estado);

                    await reply(fichaPlc(
                        { ...p1, hp: p1.hp, max_hp: p1.max_hp, energia: p1.energia, max_energia: p1.max_energia },
                        { ...p2, hp: p2.hp, max_hp: p2.max_hp, energia: p2.energia, max_energia: p2.max_energia },
                        getDataHoje()
                    ));
                    await reply(
`⚔️ *BATALHA INICIADA!*
É a vez de *${p1.nick}* (ID #${p1.id}) atacar!
Responda com o *dano causado* (apenas o número).
Ex: \`200\``
                    );
                    continue;
                }

                // ══════════════════════════════════════════
                //  PLC — PROCESSAR DANO (durante batalha)
                // ══════════════════════════════════════════
                const batalha = plcAtivo.get(remoteJid);
                if (batalha && /^\d+$/.test(text.trim()) && sender === batalha.turno) {
                    const dano = parseInt(text.trim());
                    const atacante = batalha.turno === batalha.p1.numero ? 'p1' : 'p2';
                    const defensor  = atacante === 'p1' ? 'p2' : 'p1';

                    batalha[defensor].hp_atual = Math.max(0, batalha[defensor].hp_atual - dano);

                    // Verifica fim de batalha
                    if (batalha[defensor].hp_atual <= 0) {
                        const vencedor = batalha[atacante];
                        const perdedor = batalha[defensor];
                        plcAtivo.delete(remoteJid);
                        await reply(
`🏆 *FIM DE BATALHA!*

*${vencedor.nick}* (ID #${vencedor.id}) *VENCEU!* 🎉
*${perdedor.nick}* (ID #${perdedor.id}) foi derrotado!

*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*
𖠻↬✍🏻Ass:
*⌥ʕBy NTEi🛜ʔ⌥*`
                        );
                        continue;
                    }

                    // Alterna turno
                    batalha.turno = batalha[defensor].numero;
                    const proximo = batalha[defensor];
                    plcAtivo.set(remoteJid, batalha);

                    await reply(fichaPlc(
                        { id: batalha.p1.id, nick: batalha.p1.nick, familia: batalha.p1.familia, patente: batalha.p1.patente, hp: batalha.p1.hp_atual, max_hp: batalha.p1.max_hp, energia: batalha.p1.en_atual, max_energia: batalha.p1.max_energia },
                        { id: batalha.p2.id, nick: batalha.p2.nick, familia: batalha.p2.familia, patente: batalha.p2.patente, hp: batalha.p2.hp_atual, max_hp: batalha.p2.max_hp, energia: batalha.p2.en_atual, max_energia: batalha.p2.max_energia },
                        getDataHoje()
                    ));
                    await reply(`⚔️ Agora é a vez de *${proximo.nick}* atacar!\nResponda com o número do dano.`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ADVERTIR (admin)
                // ══════════════════════════════════════════
                if (cmd === '/advertir') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @. Ex: `/advertir @user motivo`'); continue; }
                    const motivo = args.slice(2).join(' ') || 'Comportamento inadequado';
                    const t = usuarios.find(u => u.numero === mencionados[0]);
                    if (t) { t.advertencias = (t.advertencias || 0) + 1; save('usuarios', usuarios); }
                    addLog('ADVERTENCIA', `@${mencionados[0].split('@')[0]} — Motivo: ${motivo}`, sender);
                    await sock.sendMessage(remoteJid, {
                        text: `⚠️ @${mencionados[0].split('@')[0]} você recebeu uma advertência!\n📋 Motivo: ${motivo}`,
                        mentions: mencionados
                    });
                    continue;
                }

                // ══════════════════════════════════════════
                //  BAN / DESBAN (admin)
                // ══════════════════════════════════════════
                if (cmd === '/ban') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @.'); continue; }
                    const t = usuarios.find(u => u.numero === mencionados[0]);
                    if (t) { t.banido = true; save('usuarios', usuarios); }
                    try { await sock.groupParticipantsUpdate(remoteJid, mencionados, 'remove'); } catch(e) {}
                    addLog('BAN', `@${mencionados[0].split('@')[0]} banido`, sender);
                    await sock.sendMessage(remoteJid, {
                        text: `🚫 @${mencionados[0].split('@')[0]} foi banido do servidor.`,
                        mentions: mencionados
                    });
                    continue;
                }

                if (cmd === '/desban') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @.'); continue; }
                    const t = usuarios.find(u => u.numero === mencionados[0]);
                    if (t) { t.banido = false; save('usuarios', usuarios); }
                    addLog('DESBAN', `@${mencionados[0].split('@')[0]} desbanido`, sender);
                    await sock.sendMessage(remoteJid, {
                        text: `♻️ @${mencionados[0].split('@')[0]} foi desbanido!`,
                        mentions: mencionados
                    });
                    continue;
                }

                // ══════════════════════════════════════════
                //  MUTE / UNMUTE (admin)
                // ══════════════════════════════════════════
                if (cmd === '/mute') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @.'); continue; }
                    const t = usuarios.find(u => u.numero === mencionados[0]);
                    if (t) { t.mutado = true; save('usuarios', usuarios); }
                    await sock.sendMessage(remoteJid, {
                        text: `🔇 @${mencionados[0].split('@')[0]} foi silenciado.`,
                        mentions: mencionados
                    });
                    continue;
                }

                if (cmd === '/unmute') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @.'); continue; }
                    const t = usuarios.find(u => u.numero === mencionados[0]);
                    if (t) { t.mutado = false; save('usuarios', usuarios); }
                    await sock.sendMessage(remoteJid, {
                        text: `🔊 @${mencionados[0].split('@')[0]} foi desmutado.`,
                        mentions: mencionados
                    });
                    continue;
                }

                // ══════════════════════════════════════════
                //  LIMPAR FICHA (admin)
                // ══════════════════════════════════════════
                if (cmd === '/limpar-ficha') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const targetId = args[1];
                    const idx = usuarios.findIndex(u => u.id === targetId);
                    if (idx === -1) { await reply(`❌ ID #${targetId} não encontrado.`); continue; }
                    const nick = usuarios[idx].nick;
                    usuarios.splice(idx, 1);
                    save('usuarios', usuarios);
                    addLog('LIMPAR-FICHA', `${nick} (ID ${targetId}) removido`, sender);
                    await reply(`🧹 Ficha de *${nick}* (ID #${targetId}) removida do sistema.`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  ADD ADMIN / RM ADMIN (ntei)
                // ══════════════════════════════════════════
                if (cmd === '/add-admin') {
                    if (nivel !== 'ntei') { await reply('❌ Restrito ao dono do sistema.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @.'); continue; }
                    sessions.set(mencionados[0], 'admin');
                    await sock.sendMessage(remoteJid, {
                        text: `👑 @${mencionados[0].split('@')[0]} promovido a Admin!`,
                        mentions: mencionados
                    });
                    continue;
                }

                if (cmd === '/rm-admin') {
                    if (nivel !== 'ntei') { await reply('❌ Restrito ao dono do sistema.'); continue; }
                    const mencionados = getMentioned(msg);
                    if (!mencionados.length) { await reply('❌ Marque o usuário com @.'); continue; }
                    sessions.delete(mencionados[0]);
                    await sock.sendMessage(remoteJid, {
                        text: `⛔ @${mencionados[0].split('@')[0]} rebaixado.`,
                        mentions: mencionados
                    });
                    continue;
                }

                // ══════════════════════════════════════════
                //  BROADCAST (ntei)
                //  /broadcast [mensagem]
                // ══════════════════════════════════════════
                if (cmd === '/broadcast') {
                    if (nivel !== 'ntei') { await reply('❌ Restrito ao dono.'); continue; }
                    const mensagem = text.replace(/\/broadcast\s*/i, '');
                    if (!mensagem) { await reply('❌ Uso: `/broadcast [mensagem]`'); continue; }
                    let enviados = 0;
                    for (const u of usuarios) {
                        try {
                            await sock.sendMessage(u.numero, { text: `📣 *[BROADCAST OFICIAL]*\n\n${mensagem}` });
                            enviados++;
                            await delay(500);
                        } catch(e) {}
                    }
                    await reply(`📡 Broadcast enviado para ${enviados} jogador(es)!`);
                    continue;
                }

                // ══════════════════════════════════════════
                //  STATS (ntei)
                // ══════════════════════════════════════════
                if (cmd === '/stats') {
                    if (nivel !== 'ntei') { await reply('❌ Sem permissão.'); continue; }
                    const lojas = load('lojas');
                    const logs  = load('logs');
                    await reply(
`📊 *ESTATÍSTICAS DO SISTEMA*
━━━━━━━━━━━━━━━━━━━━━━
👤 Jogadores: ${usuarios.length}
🏪 Lojas: ${lojas.length}
📋 Logs: ${logs.length}
🪙 Total Ienes: ${usuarios.reduce((a, u) => a + u.ienes, 0)}
🎐 Total Fichas: ${usuarios.reduce((a, u) => a + u.fichas, 0)}
⚔️ Batalhas ativas: ${plcAtivo.size}
━━━━━━━━━━━━━━━━━━━━━━`
                    );
                    continue;
                }

                // ══════════════════════════════════════════
                //  HISTORICO (admin)
                // ══════════════════════════════════════════
                if (cmd === '/historico') {
                    if (!isAdmin) { await reply('❌ Sem permissão.'); continue; }
                    const targetId = args[1];
                    const t = usuarios.find(u => u.id === targetId);
                    if (!t) { await reply(`❌ ID #${targetId} não encontrado.`); continue; }
                    const logs = load('logs').filter(l => l.descricao?.includes(targetId)).slice(-10);
                    let str = `📜 *HISTÓRICO — ${t.nick} (ID #${targetId}):*\n\n`;
                    if (!logs.length) { str += 'Nenhum registro.'; } else {
                        logs.forEach(l => { str += `[${l.data}] *${l.tipo}* — ${l.descricao}\n`; });
                    }
                    await reply(str);
                    continue;
                }

            } catch (e) {
                console.error('[ERRO]', e);
            }
        }
    });
}

connectToWhatsApp().catch(console.error);
           