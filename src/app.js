import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { processarEGuardarCards, calcularMovimentoIA } = require('./combateIA.js');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ══════════════════════════════════════════
//           CONFIGURAÇÕES GLOBAIS
// ══════════════════════════════════════════
const CONFIG = {
    ownerNumber: '5511999999999', 
    senhaAdmin: 'admin@2626',
    senhaNtei: 'ntei@3010',
    dbPath: './database.json',
    lojaPath: './loja.json'
};

const OWNER_JID = `${CONFIG.ownerNumber}@s.whatsapp.net`;

const sessoesAdmin = new Map();
const sessoesNtei = new Map();
const floodMap = new Map();

// Tabela de Sorteios com Probabilidades Exatas do RPG
const TABELA_SORTEIO = {
    secreta: { chance: 1, itens: ["👑 Kekkijutsu do Rei", "🦊 Kekkijutsu da Kitsune", "🪽 Respiração Angelical", "🌑 Respiração do Eclipse"] },
    lendaria: { chance: 6, itens: ["🧭 Kekkijursu da Morte Destrutiva", "❄️ Kekkijutsu do Gelo", "🌙 Respiração da Lua", "🔘 Kekkijutsu Ondas de Choque", "🔆 Respiração do Sol", "🪨 Respiração da Pedra", "💀 Respiração da Morte", "🐲 Respiração do Dragão"] },
    mitica: { chance: 18, itens: ["🌊 Respiração da Água (Tomioka)", "🌫️ Respiração da Névoa", "🌀 Respiração da Fera", "❄️ Respiração da Neve", "🌅 Respiração da Aurora", "🩸 Respiração do Sangue", "💫 Kekkijutsu da Emoção", "🐠 Kekkijutsu dos Peixes", "🩸 Kekkijutsu do Sangue Venenoso", "💥 Kekkijutsu do Sangue Explosivo", "⚡ Kekkijutsu do Raio Negro", "🔯 Kekkijutsu das Memórias"] },
    epica: { chance: 30, itens: ["🌪️ Respiração do Vento", "🔥 Respiração das Chamas", "🐍 Respiração da Serpente", "🔊 Respiração do Som", "💞 Respiração do Amor", "🌟 Respiração da Estrela", "🌹 Respiração da Rosa", "🌑 Respiração da Escuridão", "💤 Kekkijutsu dos Sonhos", "🕷️ Kekkijutsu das Aranhas", "👁️‍🗨️ Kekkijutsu das Sombras", "🎀 Kekkijutsu das Faixas Obi", "🎻 Kekkijutsu da Biwa", "🗡️ Kekkijutsu dos Cortes", "🪞 Kekkijutsu dos Espelhos", "🧸 Kekkijutsu das Marionetes"] },
    rara: { chance: 45, itens: ["💧 Respiração da Água", "⚡ Respiração do Trovão", "🦋 Respiração do Inseto", "🌸 Respiração da Flor", "🕸️ Respiração da Teia", "🪶 Respiração do Pássaros", "🌱 Respiração do Broto", "🌸 Kekkijutsu da Flor", "⚽ Kekkijutsu da Temari", "🔁 Kekkijutsu da Seta", "🪘 Kekkijutsu do Tambor", "🐍 Kekkijutsu da Cobra", "🎐 Kekkijutsu do Papel", "🧿 Kekkijutsu do Olho"] }
};

// ══════════════════════════════════════════
//   BANCO DE DADOS (JSON INTEGRADO E EXPANDIDO)
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
                status_recrutamento: 'Nenhum'
            };
            this.salvar(db);
        } else {
            // Garante retrocompatibilidade se os novos campos não existirem no registro antigo
            let modificado = false;
            if (db.usuarios[id].kekkijutsu === undefined) { db.usuarios[id].kekkijutsu = 'Nenhum'; modificado = true; }
            if (db.usuarios[id].respiracao === undefined) { db.usuarios[id].respiracao = 'Nenhuma'; modificado = true; }
            if (db.usuarios[id].cards_formatados === undefined) { db.usuarios[id].cards_formatados = ''; modificado = true; }
            if (db.usuarios[id].dificuldade_ia === undefined) { db.usuarios[id].dificuldade_ia = 'medio'; modificado = true; }
            if (db.usuarios[id].status_recrutamento === undefined) { db.usuarios[id].status_recrutamento = 'Nenhum'; modificado = true; }
            if (modificado) this.salvar(db);
        }
        return { db, usuario: db.usuarios[id] };
    }
};

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
//      PROCESSO PRINCIPAL DO CONECTOR
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

                // Garante e puxa o usuário com os novos campos estruturados no JSON
                let { db, usuario } = DB.getUsuario(sender, msg.pushName);

                // ═══ SISTEMA DE SENHAS ═══
                if (cmd === '/admin') {
                    const senha = args[1];
                    if (senha === CONFIG.senhaAdmin || isDonoDireto) {
                        sessoesAdmin.set(sender, Date.now() + 3600000);
                        await sock.sendMessage(remoteJid, { text: `╭════════════════════════╗\n│      👑 PAINEL ADMIN    │\n╰════════════════════════╯\n\n╭━━━〔 👥 USUÁRIOS 〕━━━╮\n┃ 🔍 /buscar\n┃ 📜 /historico\n┃ ⚠️ /advertir\n┃ 🚫 /ban\n┃ ♻️ /desban\n┃ 🔇 /mute\n┃ 🔊 /unmute\n┃ 🧹 /limpar-ficha\n┃ ❌ /rm-ienes-id <ID> <Qtd>\n╰━━━━━━━━━━━━━━━━━━╯\n\n╭━━━〔 💰 ECONOMIA 〕━━━╮\n┃ 🪙 /add-ienes\n┃ 🪙 /rm-ienes\n┃ ⚙️ /add-eng\n┃ ⚙️ /rm-eng\n┃ 🎁 /bonus\n┃ 🧾 /extrato\n┃ 💸 /gastos\n┃ 📊 /saldo-geral\n╰━━━━━━━━━━━━━━━━━━╯` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "❌ Senha incorreta!" });
                    }
                    continue;
                }

                if (cmd === '/ntei') {
                    const senha = args[1];
                    if (senha === CONFIG.senhaNtei || isDonoDireto) {
                        sessoesNtei.set(sender, Date.now() + 3600000);
                        await sock.sendMessage(remoteJid, { text: `╭═══════════════════════════════╮\n│            ☢️ N.T.E.I ☢️         │\n│  NÚCLEO TECNOLÓGICO ESTRATÉGICO │\n│            IMPERIAL            │\n╰═══════════════════════════════╯\n\n┌〔 🔴 ACESSO OMEGA 〕┐\n│ Usuário: ${usuario.nome}\n│ Cargo: Diretor NTEI\n│ Permissão: Máxima\n└───────────────────┘\n\n╭━━━〔 💰 ECONOMIA GLOBAL 〕━━━╮\n┃ 💸 /gastos\n┃ 📈 /fluxocaixa\n┃ 🪙 /economia-global\n┃ 🏦 /banco-rpg\n╰━━━━━━━━━━━━━━━━━━━━━━╯` });
                    } else {
                        await sock.sendMessage(remoteJid, { text: "❌ Acesso OMEGA Negado!" });
                    }
                    continue;
                }

                // ═══ MENU DE USUÁRIO MODIFICADO OMEGA ═══
                if (cmd === '/menu' || cmd === '/ajuda') {
                    let menu = `╭━━━〔 🏮 𝙆𝙄𝙈𝙀𝙏𝙎𝙐 𝟒.𝟎 〕━━━╮\n`;
                    menu += `┃ 👤 Player: ${usuario.nome} (ID: ${usuario.id_rpg})\n`;
                    menu += `┃ 🪙 Ienes: ${usuario.ienes}\n`;
                    menu += `┃ ⚙️ Engrenagens: ${usuario.eng}\n`;
                    menu += `┃ 📈 Nível: ${usuario.nivel}\n`;
                    menu += `┃ 🧬 Raça: ${usuario.raca}\n`;
                    menu += `┃ 🔮 Kekkijutsu: ${usuario.kekkijutsu}\n`;
                    menu += `┃ ⚔️ Respiração: ${usuario.respiracao}\n`;
                    menu += `╰━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                    menu += `🤖 *SISTEMAS OPERACIONAIS ACTIVOS:*\n`;
                    menu += `📝 /treinar (Envie junto todo o texto dos seus 18 cards)\n`;
                    menu += `⚙️ /set-ia <facil/medio/dificil/impossivel>\n`;
                    menu += `⚔️ /vt ou /sc (Simulador Inteligente de Combate)\n`;
                    menu += `🎲 /sortear (Ganha Habilidade por Chance Real)\n`;
                    menu += `💸 /transferir <ID> <Quantidade>\n`;
                    menu += `📋 /recrutamento <texto da sua ficha>\n\n`;
                    menu += `╭─❖「 📚 CENTRAL 」❖─╮\n│ 📜 /regras-basicas\n│ 📅 /cronograma\n╰─────────────────╯\n> Powered By N.T.E.I 🛜`;

                    await sock.sendMessage(remoteJid, { text: menu });
                    continue;
                }

                // ═══ COMANDO: /SORTEAR HABILIDADES ═══
                if (cmd === '/sortear') {
                    const numeroAleatorio = Math.floor(Math.random() * 100) + 1;
                    let raridadeEscolhida = 'rara';

                    if (numeroAleatorio === 1) raridadeEscolhida = 'secreta';
                    else if (numeroAleatorio <= 7) raridadeEscolhida = 'lendaria';
                    else if (numeroAleatorio <= 25) raridadeEscolhida = 'mitica';
                    else if (numeroAleatorio <= 55) raridadeEscolhida = 'epica';

                    const listaDeItens = TABELA_SORTEIO[raridadeEscolhida].itens;
                    const itemGanho = listaDeItens[Math.floor(Math.random() * listaDeItens.length)];

                    if (itemGanho.toLowerCase().includes('kekkijutsu')) {
                        usuario.kekkijutsu = itemGanho;
                    } else {
                        usuario.respiracao = itemGanho;
                    }
                    
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);

                    let msgSorteio = `🎲 *SISTEMA DE SORTEIO OMEGA* 🎲\n\n`;
                    msgSorteio += `👤 *Jogador:* ${usuario.nome}\n`;
                    msgSorteio += `✨ *Raridade:* [${raridadeEscolhida.toUpperCase()}]\n`;
                    msgSorteio += `🎁 *Ganhou:* ${itemGanho}\n\n`;
                    msgSorteio += `Os dados foram atualizados no banco JSON!`;

                    await sock.sendMessage(remoteJid, { text: msgSorteio });
                    continue;
                }

                // ═══ COMANDO: /TREINAR (CÓPIA E ASSIMILAÇÃO DOS 18 CARDS) ═══
                if (cmd === '/treinar') {
                    const blocoCards = text.replace(/^\/[a-zA-Z]+/i, '').trim();
                    if (!blocoCards) {
                        await sock.sendMessage(remoteJid, { text: "❌ Envie o comando acompanhado de todo o texto com os seus 18 cards formatados!" });
                        continue;
                    }

                    const formatacaoLimpa = processarEGuardarCards(blocoCards);
                    usuario.cards_formatados = formatacaoLimpa;
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);

                    await sock.sendMessage(remoteJid, { text: "✅ *APRENDIZADO DE DECK CONCLUÍDO!*\n\nO bot guardou perfeitamente os seus cards. A IA assimilou os movimentos para rodar sozinha usando /vt ou /sc." });
                    continue;
                }

                // ═══ COMANDOS DE SIMULAÇÃO DE COMBATE: /VT OU /SC ═══
                if (cmd === '/vt' || cmd === '/sc') {
                    const tipoModo = cmd === '/vt' ? 'Vantagem Tática (VT)' : 'Simulação Crítica (SC)';
                    const diff = usuario.dificuldade_ia || 'medio';

                    const movimento = calcularMovimentoIA(usuario.cards_formatados, diff);

                    let plcText = `*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*\n`;
                    plcText += ` _Modo Operacional: ${tipoModo}_\n`;
                    plcText += ` *႟⚔️୨ Combate Automatizado Inteligente ୧️႟*\n`;
                    plcText += ` *⊢📆〣 Dificuldade da IA: ${diff.toUpperCase()} 〣⊣*\n\n`;
                    plcText += `*၍👤 ID-RPG:* ${usuario.id_rpg} | *Player:* ${usuario.nome}\n`;
                    plcText += `*❣️ Status:* Ativo em Campo ⚡\n`;
                    plcText += `       🆚\n`;
                    plcText += `*၍🤖 BOT Inteligência Artificial*\n`;
                    plcText += `*🎯 Estratégia:* ${movimento.estrategia}\n`;
                    plcText += `*💥 Movimento Escolhido:* ${movimento.card}\n\n`;
                    plcText += `*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*\n`;
                    plcText += `_ ↬✍ Placar Gerado Via: *⌥ By NTEi 🛜 ʔ⌥*`;

                    await sock.sendMessage(remoteJid, { text: plcText });
                    continue;
                }

                // ═══ COMANDO: /TRANSFERIR VIA ID ═══
                if (cmd === '/transferir') {
                    const targetId = parseInt(args[1]);
                    const quantia = parseInt(args[2]);

                    if (!targetId || !quantia || quantia <= 0) {
                        await sock.sendMessage(remoteJid, { text: "❌ Use correto: `/transferir <ID-do-Alvo> <Quantidade>`" });
                        continue;
                    }

                    if (usuario.ienes < quantia) {
                        await sock.sendMessage(remoteJid, { text: "❌ Você não tem saldo em Ienes suficiente para essa operação!" });
                        continue;
                    }

                    const alvoJid = Object.keys(db.usuarios).find(key => db.usuarios[key].id_rpg === targetId);
                    if (!alvoJid) {
                        await sock.sendMessage(remoteJid, { text: "❌ Ninguém foi localizado na base com esse ID informado." });
                        continue;
                    }

                    usuario.ienes -= quantia;
                    db.usuarios[alvoJid].ienes += quantia;
                    DB.salvar(db);

                    let txtTransf = `💸 *FICHA DE TRANSFERÊNCIA FINANCEIRA*\n\n`;
                    txtTransf += `📤 *Remetente:* ${usuario.nome} (ID: ${usuario.id_rpg})\n`;
                    txtTransf += `📥 *Destinatário:* ${db.usuarios[alvoJid].nome} (ID: ${targetId})\n`;
                    txtTransf += `🪙 *Valor Movimentado:* ${quantia} Ienes\n\n`;
                    txtTransf += `✍ *Ass:* ⌥ Superiores ⌥`;

                    await sock.sendMessage(remoteJid, { text: txtTransf });
                    continue;
                }

                // ═══ COMANDO ADMINISTRATIVO: /RM-IENES-ID ═══
                if (cmd === '/rm-ienes-id') {
                    if (!isDonoDireto && !hasAdminSession) {
                        await sock.sendMessage(remoteJid, { text: "❌ Comando restrito a Administradores autenticados." });
                        continue;
                    }

                    const targetId = parseInt(args[1]);
                    const quantia = parseInt(args[2]);

                    if (!targetId || !quantia || quantia <= 0) {
                        await sock.sendMessage(remoteJid, { text: "❌ Use: `/rm-ienes-id <ID> <Quantidade>`" });
                        continue;
                    }

                    const alvoJid = Object.keys(db.usuarios).find(key => db.usuarios[key].id_rpg === targetId);
                    if (!alvoJid) {
                        await sock.sendMessage(remoteJid, { text: "❌ Jogador não encontrado!" });
                        continue;
                    }

                    db.usuarios[alvoJid].ienes = Math.max(0, db.usuarios[alvoJid].ienes - quantia);
                    DB.salvar(db);

                    await sock.sendMessage(remoteJid, { text: `✅ Sucesso! Removidos ${quantia} Ienes do ID ${targetId} (${db.usuarios[alvoJid].nome}).` });
                    continue;
                }

                // ═══ COMANDO: /SET-IA (DIFICULDADE) ═══
                if (cmd === '/set-ia') {
                    const novaDiff = args[1]?.toLowerCase();
                    if (!['facil', 'medio', 'dificil', 'impossivel'].includes(novaDiff)) {
                        await sock.sendMessage(remoteJid, { text: "❌ Escolha: `/set-ia facil`, `medio`, `dificil` ou `impossivel`" });
                        continue;
                    }
                    usuario.dificuldade_ia = novaDiff;
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);
                    await sock.sendMessage(remoteJid, { text: `⚙️ Inteligência tática configurada para: *${novaDiff.toUpperCase()}*` });
                    continue;
                }

                // ═══ COMANDO: /RECRUTAMENTO (ENVIO PARA ANÁLISE) ═══
                if (cmd === '/recrutamento') {
                    const fichaDados = args.slice(1).join(' ');
                    if (!fichaDados) {
                        await sock.sendMessage(remoteJid, { text: "❌ Digite o texto ou envie a sua ficha de recrutamento após o comando." });
                        continue;
                    }

                    usuario.status_recrutamento = 'Em Análise';
                    db.usuarios[sender] = usuario;
                    DB.salvar(db);

                    await sock.sendMessage(remoteJid, { text: "⏳ *SISTEMA DE ANÁLISE DE ADMISSÃO*\n\nSua ficha foi registrada com sucesso! Seu status foi definido para *Em Análise*. Aguarde até que um superior julgue sua aptidão." });
                    continue;
                }

                // INTERCEPTAÇÃO AUTOMÁTICA DE FICHA (Sua função nativa intacta)
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
                            kekkijutsu: 'Nenhum', respiracao: 'Nenhuma', cards_formatados: '', dificuldade_ia: 'medio', status_recrutamento: 'Aprovado'
                        };
                        DB.salvar(dbData);

                        await sock.sendMessage(remoteJid, {
                            text: `➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄\n🤺 ᗂ ⛩️ Kimetsu New Age ⛩️ ᗃ 🤺\n\n📃 RECRUTAMENTO APROVADO! 📃\n_￫🆔◈ ID:  ⌊ ${novoId} ⌉_\n_￫🧾◈ Nick:  ⌊ ${nick} ⌉_\n_￫🧬◈ Raça:  ⌊ ❓ Indefinida ⌉_\n_￫⛩️◈ Família:  ⌊ ${fam} ⌉_\n_￫🏙️◈ Nação:  ⌊ ${nac} ⌉_\n_￫🔘◈ Patente:  ⌊ ⏺️ Cidadão ⌉_\n_￫✒️◈ Recrutador:  ⌊ ${rec} ⌉_\n➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄\n🍊 Bem-vindo(a) ao RPG, @${senderParam}!\nUse */escolher raça Humano* ou */escolher raça Oni* para definir sua raça!`,
                            mentions: [sender]
                        });
                        continue;
                    }
                }

                // ESCOLHA DE RAÇAS OU FAMÍLIAS (Sua função nativa intacta)
                if (cmd === '/escolher') {
                    const tipo = args[1]?.toLowerCase();
                    const escolha = args.slice(2).join(' ');

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

                // FILTRO DE COMANDOS NÃO ADICIONADOS
                if (cmd.startsWith('/')) {
                    const listaComandosExistentes = ['/admin', '/ntei', '/menu', '/ajuda', '/sortear', '/treinar', '/vt', '/sc', '/transferir', '/rm-ienes-id', '/set-ia', '/recrutamento', '/escolher'];
                    if (!listaComandosExistentes.includes(cmd)) {
                        await sock.sendMessage(remoteJid, { text: `⚠️ *Aviso do Sistema Kimetsu 4.0*:\n\nO comando \`${cmd}\` não se encontra adicionado ou ativo nas configurações do bot.` });
                    }
                }

            } catch (err) { console.error("Erro interno:", err); }
        }
    });
}

connectToWhatsApp();
