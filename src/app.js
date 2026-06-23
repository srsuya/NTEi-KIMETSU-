// ══════════════════════════════════════════
//   BOT ALDEIA DO NORTE - KIMETSU 4.0 OMEGA
//   Plataforma: Baileys ES Modules (Termux)
// ══════════════════════════════════════════

import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Tenta carregar o módulo de IA. Se não existir, gera simulações de fallback seguras.
let processarEGuardarCards = (txt) => txt;
let calcularMovimentoIA = (cards, diff) => {
    return { estrategia: "Ataque Frontal Dinâmico", card: "Card Aleatório Baseado no Deck" };
};
try {
    const combateIA = require('./combateIA.js');
    if (combateIA.processarEGuardarCards) processarEGuardarCards = combateIA.processarEGuardarCards;
    if (combateIA.calcularMovimentoIA) calcularMovimentoIA = combateIA.calcularMovimentoIA;
} catch (e) {
    console.log("⚠️ Módulo ./combateIA.js não encontrado. Usando emulação nativa.");
}

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ══════════════════════════════════════════
//             CONFIGURAÇÕES GLOBAIS
// ══════════════════════════════════════════
const CONFIG = {
    ownerNumber: '5511999999999', 
    senhaAdmin: 'admin@2626',
    senhaNtei: 'ntei@3010',
    dbPath: './database.json',
    lojaPath: './loja.json',
    prefixo: '/'
};

const OWNER_JID = `${CONFIG.ownerNumber}@s.whatsapp.net`;

const sessoesAdmin = new Map();
const sessoesNtei = new Map();
const floodMap = new Map();
const cooldowns = new Map();

// Tabela de Sorteios com Probabilidades Exatas do RPG
const TABELA_SORTEIO = {
    secreta: { chance: 1, itens: ["👑 Kekkijutsu do Rei", "🦊 Kekkijutsu da Kitsune", "🪽 Respiração Angelical", "🌑 Respiração do Eclipse"] },
    lendaria: { chance: 6, itens: ["🧭 Kekkijursu da Morte Destrutiva", "❄️ Kekkijutsu do Gelo", "🌙 Respiração da Lua", "🔘 Kekkijutsu Ondas de Choque", "🔆 Respiração do Sol", "🪨 Respiração da Pedra", "💀 Respiração da Morte", "🐲 Respiração do Dragão"] },
    mitica: { chance: 18, itens: ["🌊 Respiração da Água (Tomioka)", "🌫️ Respiração da Névoa", "🌀 Respiração da Fera", "❄️ Respiração da Neve", "🌅 Respiração da Aurora", "🩸 Respiração do Sangue", "💫 Kekkijutsu da Emoção", "🐠 Kekkijutsu dos Peixes", "🩸 Kekkijutsu do Sangue Venenoso", "💥 Kekkijutsu do Sangue Explosivo", "⚡ Kekkijutsu do Raio Negro", "🔯 Kekkijutsu das Memórias"] },
    epica: { chance: 30, itens: ["🌪️ Respiração do Vento", "🔥 Respiração das Chamas", "🐍 Respiração da Serpente", "🔊 Respiração do Som", "💞 Respiração do Amor", "🌟 Respiração da Estrela", "🌹 Respiração da Rosa", "🌑 Respiração da Escuridão", "💤 Kekkijutsu dos Sonhos", "🕷️ Kekkijutsu das Aranhas", "👁️‍🗨️ Kekkijutsu das Sombras", "🎀 Kekkijutsu das Faixas Obi", "🎻 Kekkijutsu da Biwa", "🗡️ Kekkijutsu dos Cortes", "🪞 Kekkijutsu dos Espelhos", "🧸 Kekkijutsu das Marionetes"] },
    rara: { chance: 45, itens: ["💧 Respiração da Água", "⚡ Respiração do Trovão", "🦋 Respiração do Inseto", "🌸 Respiração da Flor", "🕸️ Respiração da Teia", "🪶 Respiração do Pássaros", "🌱 Respiração do Broto", "🌸 Kekkijutsu da Flor", "⚽ Kekkijutsu da Temari", "🔁 Kekkijutsu da Seta", "🪘 Kekkijutsu do Tambor", "🐍 Kekkijutsu da Cobra", "🎐 Kekkijutsu do Papel", "🧿 Kekkijutsu do Olho"] }
};

// ══════════════════════════════════════════
//   BANCO DE DADOS JSON UNIFICADO
// ══════════════════════════════════════════
const DB = {
    carregar() {
        if (!fs.existsSync(CONFIG.dbPath)) {
            const inicial = { usuarios: {}, aldeia: { ienes: 333830 }, logs: [], bans: {}, mutes: {} };
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
                nome, 
                id_rpg: 1000 + Object.keys(db.usuarios).length, 
                ienes: 0, 
                eng: 0, 
                xp: 0, 
                nivel: 1, 
                raca: 'Indefinida', 
                familia: 'Nenhuma', 
                nacao: 'Aldeia do Norte', 
                patente: '⏺️ Cidadão', 
                recrutador: 'Sistema',
                kekkijutsu: 'Nenhum',
                respiracao: 'Nenhuma',
                cards_formatados: '',
                dificuldade_ia: 'medio',
                status_recrutamento: 'Nenhum',
                inventario: [],
                advertencias: 0
            };
            this.salvar(db);
        }
        return { db, usuario: db.usuarios[id] };
    },
    registrarLog(tipo, descricao, autor, alvo = null) {
        const db = this.carregar();
        if (!db.logs) db.logs = [];
        db.logs.unshift({ tipo, descricao, autor, alvo, data: new Date().toLocaleString('pt-BR') });
        if (db.logs.length > 500) db.logs = db.logs.slice(0, 500);
        this.salvar(db);
    }
};

function getLojaDB() {
    if (!fs.existsSync(CONFIG.lojaPath)) {
        fs.writeFileSync(CONFIG.lojaPath, JSON.stringify({ itens: [] }, null, 2));
    }
    return JSON.parse(fs.readFileSync(CONFIG.lojaPath));
}
function salvarLoja(data) {
    fs.writeFileSync(CONFIG.lojaPath, JSON.stringify(data, null, 2));
}

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

const fmt = (n) => Number(n).toLocaleString('pt-BR');

// ══════════════════════════════════════════
//          CONECTOR PRINCIPAL BAILEYS
// ══════════════════════════════════════════
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

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
        if (connection === 'open') console.log('🍊 Kimetsu Omega Bot conectado com sucesso no seu Termux!');
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

                // Verificações Globais de Bloqueio (Mute/Ban)
                const globalDB = DB.carregar();
                if (globalDB.bans?.[sender]) continue;
                if (globalDB.mutes?.[sender] && !text.startsWith('/unmute')) continue;

                const isDonoDireto = (sender === OWNER_JID || `${senderParam}@s.whatsapp.net` === OWNER_JID);
                const hasAdminSession = sessoesAdmin.has(sender) && sessoesAdmin.get(sender) > Date.now();
                const hasNteiSession = sessoesNtei.has(sender) && sessoesNtei.get(sender) > Date.now();

                if (!isDonoDireto && !hasNteiSession && checkFlood(sender)) continue;

                const args = text.split(' ');
                const cmd = args[0].toLowerCase();
                const resto = args.slice(1);
                const mencao = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] || null;

                let { db, usuario } = DB.getUsuario(sender, msg.pushName);

                // Autenticação Administrativa Básica
                const isAdmin = isDonoDireto || hasAdminSession || hasNteiSession;
                const isNtei = isDonoDireto || hasNteiSession;

                // INTERCEPTAÇÃO AUTOMÁTICA DE FICHA
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
                            raca: 'Indefinida', familia: fam, nacao: nac, patente: '⏺️ Cidadão', recrutador: rec,
                            kekkijutsu: 'Nenhum', respiracao: 'Nenhuma', cards_formatados: '', dificuldade_ia: 'medio', status_recrutamento: 'Aprovado',
                            inventario: [], advertencias: 0
                        };
                        DB.salvar(dbData);

                        await sock.sendMessage(remoteJid, {
                            text: ` Republicado sob Controle OMEGA:\n\n📃 RECRUTAMENTO APROVADO! 📃\n_￫🆔◈ ID:  ⌊ ${novoId} ⌉_\n_￫🧾◈ Nick:  ⌊ ${nick} ⌉_\n_￫🧬◈ Raça:  ⌊ ❓ Indefinida ⌉_\n_￫⛩️◈ Família:  ⌊ ${fam} ⌉_\n_￫🏙️◈ Nação:  ⌊ ${nac} ⌉_\n_￫🔘◈ Patente:  ⌊ ⏺️ Cidadão ⌉_\n_￫✒️◈ Recrutador:  ⌊ ${rec} ⌉_\n🍊 Bem-vindo(a) ao RPG, @${senderParam}!\nUse */escolher raça Humano* ou */escolher raça Oni* para definir sua jornada!`,
                            mentions: [sender]
                        });
                        continue;
                    }
                }

                // ═══ COMANDOS PÚBLICOS ═══

                if (cmd === '/menu' || cmd === '/ajuda') {
                    let menu = `╭━━━〔 🏮 𝙆𝙄𝙈𝙀𝙏𝙎𝙐 𝟒.𝟎 〕━━━╮\n`;
                    menu += `┃ 👤 Player: ${usuario.nome} (ID: ${usuario.id_rpg})\n`;
                    menu += `┃ 🪙 Ienes: ${fmt(usuario.ienes)}\n`;
                    menu += `┃ ⚙️ Engrenagens: ${fmt(usuario.eng)}\n`;
                    menu += `┃ 📈 Nível: ${usuario.nivel} | XP: ${usuario.xp}\n`;
                    menu += `┃ 🧬 Raça: ${usuario.raca}\n`;
                    menu += `┃ 🔮 Kekkijutsu: ${usuario.kekkijutsu}\n`;
                    menu += `┃ ⚔️ Respiração: ${usuario.respiracao}\n`;
                    menu += `╰━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                    menu += `🤖 *SISTEMAS OPERACIONAIS ACTIVOS:*\n`;
                    menu += `📝 /treinar (Envie junto o texto dos seus cards)\n`;
                    menu += `⚙️ /set-ia <facil/medio/dificil/impossivel>\n`;
                    menu += `⚔️ /vt ou /sc (Simulador de Combate)\n`;
                    menu += `🎲 /sortear (Ganha Habilidade Aleatória)\n`;
                    menu += `💸 /transferir <ID> <Quantidade>\n`;
                    menu += `🔨 /trabalhar (Ganha moedas temporais)\n`;
                    menu += `🏪 /loja | /comprar [item] | /inventario\n`;
                    menu += `📋 /recrutamento <texto da sua ficha>\n\n`;
                    menu += `> Powered By N.T.E.I 🛜`;
                    await sock.sendMessage(remoteJid, { text: menu });
                    continue;
                }

                if (cmd === '/admin') {
                    const senha = args[1];
                    if (senha === CONFIG.senhaAdmin || isDonoDireto) {
                        sessoesAdmin.set(sender, Date.now() + 3600000);
                        await sock.sendMessage(remoteJid, { text: `👑 *Painel Admin Liberado* 👑\n\nComandos ativos:\n/add-ienes @mencao valor\n/rm-ienes @mencao valor\n/rm-ienes-id <ID> <Qtd>\n/advertir @mencao motivo\n/ban @mencao\n/desban @mencao\n/mute @mencao\n/unmute @mencao\n/add-item nome|preco` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "❌ Senha incorreta!" });
                    }
                    continue;
                }

                if (cmd === '/ntei') {
                    const senha = args[1];
                    if (senha === CONFIG.senhaNtei || isDonoDireto) {
                        sessoesNtei.set(sender, Date.now() + 3600000);
                        await sock.sendMessage(remoteJid, { text: `☢️ *ACESSO OMEGA NTEI ATIVADO* ☢️\n\nComandos adicionais:\n/economia-global\n/fluxocaixa\n/status\n/backup\n/resetusuario @mencao` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "❌ Acesso OMEGA Negado!" });
                    }
                    continue;
                }

                if (cmd === '/sortear') {
                    const numeroAleatorio = Math.floor(Math.random() * 100) + 1;
                    let raridadeEscolhida = 'rara';
                    if (numeroAleatorio === 1) raridadeEscolhida = 'secreta';
                    else if (numeroAleatorio <= 7) raridadeEscolhida = 'lendaria';
                    else if (numeroAleatorio <= 25) raridadeEscolhida = 'mitica';
                    else if (numeroAleatorio <= 55) raridadeEscolhida = 'epica';

                    const listaDeItens = TABELA_SORTEIO[raridadeEscolhida].itens;
                    const itemGanho = listaDeItens[Math.floor(Math.random() * listaDeItens.length)];

                    if (itemGanho.toLowerCase().includes('kekkijutsu')) usuario.kekkijutsu = itemGanho;
                    else usuario.respiracao = itemGanho;
                    
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);

                    let msgSorteio = `🎲 *SISTEMA DE SORTEIO OMEGA* 🎲\n\n👤 *Jogador:* ${usuario.nome}\n✨ *Raridade:* [${raridadeEscolhida.toUpperCase()}]\n🎁 *Ganhou:* ${itemGanho}`;
                    await sock.sendMessage(remoteJid, { text: msgSorteio });
                    continue;
                }

                if (cmd === '/treinar') {
                    const blocoCards = text.replace(/^\/[a-zA-Z]+/i, '').trim();
                    if (!blocoCards) {
                        await sock.sendMessage(remoteJid, { text: "❌ Forneça os textos dos cards após o comando!" });
                        continue;
                    }
                    usuario.cards_formatados = processarEGuardarCards(blocoCards);
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: "✅ *DECK DE COMBATE ASSIMILADO COM SUCESSO PELA IA!*" });
                    continue;
                }

                if (cmd === '/vt' || cmd === '/sc') {
                    const diff = usuario.dificuldade_ia || 'medio';
                    const movimento = calcularMovimentoIA(usuario.cards_formatados, diff);
                    let plcText = `⚔️ *Combate Inteligente Automatizado* ⚔️\n\n👤 *Player:* ${usuario.nome} (ID: ${usuario.id_rpg})\n🎯 *Estratégia IA:* ${movimento.estrategia}\n💥 *Movimento Escolhido:* ${movimento.card}`;
                    await sock.sendMessage(remoteJid, { text: plcText });
                    continue;
                }

                if (cmd === '/trabalhar') {
                    const agora = Date.now();
                    const ultimo = cooldowns.get(sender) || 0;
                    if (agora - ultimo < 3600000) {
                        const falta = Math.ceil((3600000 - (agora - ultimo)) / 60000);
                        await sock.sendMessage(remoteJid, { text: `⏳ Descanse! Faltam ${falta} minutos para trabalhar novamente.` });
                        continue;
                    }
                    const ganho = Math.floor(Math.random() * 400) + 150;
                    usuario.ienes += ganho;
                    usuario.xp += 15;
                    if (usuario.xp >= usuario.nivel * 100) {
                        usuario.nivel += 1;
                        await sock.sendMessage(remoteJid, { text: `🎉 Parabéns! Você subiu para o Nível ${usuario.nivel}!` });
                    }
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);
                    cooldowns.set(sender, agora);
                    await sock.sendMessage(remoteJid, { text: `🔨 Você trabalhou duro e coletou +${ganho} Ienes e +15 XP!` });
                    continue;
                }

                if (cmd === '/transferir') {
                    const targetId = parseInt(args[1]);
                    const quantia = parseInt(args[2]);
                    if (!targetId || !quantia || quantia <= 0) {
                        await sock.sendMessage(remoteJid, { text: "❌ Formato: `/transferir <ID> <Quantidade>`" });
                        continue;
                    }
                    if (usuario.ienes < quantia) {
                        await sock.sendMessage(remoteJid, { text: "❌ Saldo insuficiente." });
                        continue;
                    }
                    const alvoJid = Object.keys(db.usuarios).find(key => db.usuarios[key].id_rpg === targetId);
                    if (!alvoJid) {
                        await sock.sendMessage(remoteJid, { text: "❌ ID não localizado no servidor." });
                        continue;
                    }
                    usuario.ienes -= quantia;
                    db.usuarios[alvoJid].ienes += quantia;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `💸 *Transferência Efetuada!*\nDe: ${usuario.nome}\nPara: ${db.usuarios[alvoJid].nome}\nValor: ${quantia} Ienes` });
                    continue;
                }

                if (cmd === '/escolher') {
                    const tipo = args[1]?.toLowerCase();
                    const escolha = args.slice(2).join(' ');
                    if (tipo === 'raça' || tipo === 'raca') {
                        if (usuario.raca !== 'Indefinida') {
                            await sock.sendMessage(remoteJid, { text: `❌ Você já é da raça ${usuario.raca}.` });
                            continue;
                        }
                        usuario.raca = escolha.toLowerCase() === 'oni' ? '👹 Oni' : '👱‍♂️ Humano';
                        db.usuarios[sender] = usuario;
                        DB.salvar(db);
                        await sock.sendMessage(remoteJid, { text: `✅ Raça definida com sucesso para: *${usuario.raca}*` });
                    }
                    continue;
                }

                if (cmd === '/loja') {
                    const loja = getLojaDB();
                    let txt = `🏪 *LOJA IMPERIAL DA ALDEIA* 🏪\n\n`;
                    if (!loja.itens.length) txt += `Nenhum item à venda no momento.`;
                    loja.itens.forEach((item, i) => { txt += `${i+1}. ${item.nome} — ${fmt(item.preco)} 🪙\n`; });
                    await sock.sendMessage(remoteJid, { text: txt });
                    continue;
                }

                if (cmd === '/comprar') {
                    const nomeItem = resto.join(' ');
                    const loja = getLojaDB();
                    const item = loja.itens.find(i => i.nome.toLowerCase() === nomeItem.toLowerCase());
                    if (!item) { await sock.sendMessage(remoteJid, { text: "❌ Item indisponível." }); continue; }
                    if (usuario.ienes < item.preco) { await sock.sendMessage(remoteJid, { text: "❌ Ienes insuficientes." }); continue; }
                    usuario.ienes -= item.preco;
                    if (!usuario.inventario) usuario.inventario = [];
                    usuario.inventario.push(item.nome);
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `✅ Você adquiriu [${item.nome}] com sucesso!` });
                    continue;
                }

                if (cmd === '/inventario') {
                    const inv = usuario.inventario || [];
                    let txt = `🎒 *Seu Inventário:* \n\n`;
                    if (!inv.length) txt += `Vazio.`;
                    inv.forEach(i => txt += `• ${i}\n`);
                    await sock.sendMessage(remoteJid, { text: txt });
                    continue;
                }

                if (cmd === '/set-ia') {
                    const novaDiff = args[1]?.toLowerCase();
                    if (!['facil', 'medio', 'dificil', 'impossivel'].includes(novaDiff)) {
                        await sock.sendMessage(remoteJid, { text: "❌ Opções válidas: facil, medio, dificil, impossivel" });
                        continue;
                    }
                    usuario.dificuldade_ia = novaDiff;
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `⚙️ Dificuldade alterada para *${novaDiff.toUpperCase()}*` });
                    continue;
                }

                if (cmd === '/recrutamento') {
                    const fichaDados = args.slice(1).join(' ');
                    if (!fichaDados) { await sock.sendMessage(remoteJid, { text: "❌ Insira os dados da ficha." }); continue; }
                    usuario.status_recrutamento = 'Em Análise';
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: "⏳ Sua ficha foi enviada para o banco de dados. Status: *Em Análise*." });
                    continue;
                }

                // ═══ COMANDOS ADMINISTRATIVOS (VALIDADOS) ═══

                if (cmd === '/add-ienes') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    const valor = parseInt(resto[1]);
                    if (!mencao || !valor) { await sock.sendMessage(remoteJid, { text: "❌ Use: /add-ienes @mencao valor" }); continue; }
                    const { usuario: uAlvo } = DB.getUsuario(mencao);
                    uAlvo.ienes += valor;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `✅ Adicionado ${valor} Ienes ao saldo de @${mencao.split('@')[0]}`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/rm-ienes') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    const valor = parseInt(resto[1]);
                    if (!mencao || !valor) { await sock.sendMessage(remoteJid, { text: "❌ Use: /rm-ienes @mencao valor" }); continue; }
                    const { usuario: uAlvo } = DB.getUsuario(mencao);
                    uAlvo.ienes = Math.max(0, uAlvo.ienes - valor);
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `✅ Removido ${valor} Ienes de @${mencao.split('@')[0]}`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/rm-ienes-id') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão administrativo." }); continue; }
                    const targetId = parseInt(args[1]);
                    const quantia = parseInt(args[2]);
                    if (!targetId || !quantia) { await sock.sendMessage(remoteJid, { text: "❌ Use: `/rm-ienes-id <ID> <Quantidade>`" }); continue; }
                    const alvoJid = Object.keys(db.usuarios).find(key => db.usuarios[key].id_rpg === targetId);
                    if (!alvoJid) { await sock.sendMessage(remoteJid, { text: "❌ Usuário não localizado." }); continue; }
                    db.usuarios[alvoJid].ienes = Math.max(0, db.usuarios[alvoJid].ienes - quantia);
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `✅ Reduzido ${quantia} Ienes do ID ${targetId}.` });
                    continue;
                }

                if (cmd === '/advertir') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    if (!mencao) { await sock.sendMessage(remoteJid, { text: "❌ Marque o infrator." }); continue; }
                    const { usuario: uAlvo } = DB.getUsuario(mencao);
                    uAlvo.advertencias = (uAlvo.advertencias || 0) + 1;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `⚠️ Usuário @${mencao.split('@')[0]} foi advertido! Total: ${uAlvo.advertencias}`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/ban') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    if (!mencao) { await sock.sendMessage(remoteJid, { text: "❌ Forneça a menção." }); continue; }
                    db.bans = db.bans || {};
                    db.bans[mencao] = true;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `🚫 Usuário @${mencao.split('@')[0]} banido com sucesso!`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/desban') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    if (!mencao) { await sock.sendMessage(remoteJid, { text: "❌ Forneça a menção." }); continue; }
                    db.bans = db.bans || {};
                    delete db.bans[mencao];
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `♻️ Usuário revogado do banimento!`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/mute') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    if (!mencao) { await sock.sendMessage(remoteJid, { text: "❌ Forneça a menção." }); continue; }
                    db.mutes = db.mutes || {};
                    db.mutes[mencao] = true;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `🔇 @${mencao.split('@')[0]} mutado no sistema.`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/unmute') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    if (!mencao) { await sock.sendMessage(remoteJid, { text: "❌ Forneça a menção." }); continue; }
                    db.mutes = db.mutes || {};
                    delete db.mutes[mencao];
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `🔊 @${mencao.split('@')[0]} desmutado.`, mentions: [mencao] });
                    continue;
                }

                if (cmd === '/add-item') {
                    if (!isAdmin) { await sock.sendMessage(remoteJid, { text: "❌ Sem permissão." }); continue; }
                    const partes = resto.join(' ').split('|');
                    if (partes.length < 2) { await sock.sendMessage(remoteJid, { text: "❌ Use: /add-item nome|preco" }); continue; }
                    const loja = getLojaDB();
                    loja.itens.push({ nome: partes[0].trim(), preco: parseInt(partes[1]) });
                    salvarLoja(loja);
                    await sock.sendMessage(remoteJid, { text: `✅ Item adicionado na loja!` });
                    continue;
                }

                // ═══ COMANDOS EXCLUSIVOS OMEGA NTEI ═══

                if (cmd === '/economia-global') {
                    if (!isNtei) { await sock.sendMessage(remoteJid, { text: "❌ Restrito ao NTEI OMEGA." }); continue; }
                    const totalCirculando = Object.values(db.usuarios).reduce((acc, curr) => acc + (curr.ienes || 0), 0);
                    await sock.sendMessage(remoteJid, { text: `🌐 *Estatísticas Econômicas:* \n\nTotal em Circulação: ${fmt(totalCirculando)} Ienes\nFundo Governamental: ${fmt(db.aldeia.ienes)} Ienes` });
                    continue;
                }

                if (cmd === '/resetusuario') {
                    if (!isNtei) { await sock.sendMessage(remoteJid, { text: "❌ Restrito ao NTEI." }); continue; }
                    if (!mencao) { await sock.sendMessage(remoteJid, { text: "❌ Mencione o alvo." }); continue; }
                    delete db.usuarios[mencao];
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `✅ Perfil completamente purgado do JSON.` });
                    continue;
                }

                if (cmd === '/status') {
                    if (!isNtei) { await sock.sendMessage(remoteJid, { text: "❌ Restrito." }); continue; }
                    await sock.sendMessage(remoteJid, { text: `📡 *Tangerina OS Ativo*\nModo: Baileys Unificado\nCadastrados: ${Object.keys(db.usuarios).length} players.` });
                    continue;
                }

                if (cmd === '/backup') {
                    if (!isNtei) return;
                    fs.writeFileSync(`./backup_${Date.now()}.json`, JSON.stringify(db, null, 2));
                    await sock.sendMessage(remoteJid, { text: "✅ Backup estrutural JSON concluído." });
                    continue;
                }

                // Aviso de comando não implementado
                if (cmd.startsWith('/')) {
                    const validos = ['/admin', '/ntei', '/menu', '/ajuda', '/sortear', '/treinar', '/vt', '/sc', '/transferir', '/rm-ienes-id', '/set-ia', '/recrutamento', '/escolher', '/loja', '/comprar', '/inventario', '/trabalhar', '/add-ienes', '/rm-ienes', '/advertir', '/ban', '/desban', '/mute', '/unmute', '/add-item', '/economia-global', '/resetusuario', '/status', '/backup'];
                    if (!validos.includes(cmd)) {
                        await sock.sendMessage(remoteJid, { text: `⚠️ Comando \`${cmd}\` indisponível no Kimetsu 4.0.` });
                    }
                }

            } catch (err) { console.error("Erro interno no loop:", err); }
        }
    });
}

connectToWhatsApp();
