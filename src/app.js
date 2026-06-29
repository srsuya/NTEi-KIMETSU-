// ══════════════════════════════════════════════════════════
//   KIMETSU NEW AGE 4.0  —  by NTEi
//   WhatsApp RPG Bot  |  Baileys + SQLite
// ══════════════════════════════════════════════════════════

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    Browsers,
    fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';

import { runAllMigrations }     from './database/migrations/init.js';
import logger                   from './utils/logger.js';
import { extractText, getMentioned, getNivel, checkFlood, LINK_REGEX } from './utils/helpers.js';
import { iniciarBackupAutomatico, realizarBackup } from './services/backup.js';

// ─── COMMANDS ────────────────────────────────────────────
import { commandPerfil }            from './commands/rpg/perfil.js';
import { commandInventario, commandSalvarInventario } from './commands/rpg/inventario.js';
import { commandTecnicas }          from './commands/rpg/tecnicas.js'; 
import { commandFamilias, commandEscolherFamilia }    from './commands/rpg/familias.js';
import { commandTransferir, commandRemoverTransferencia, commandExtrato } from './commands/economia/transferencias.js';
import {
    cmdAddIenes, cmdRmIenes, cmdAddEng, cmdRmEng, cmdAddFichas, cmdRmFichas,
    cmdAddXp, cmdRmXp, cmdSetPatente, cmdResetUsuario, cmdResetRaca,
    cmdAddAdminBot, cmdRemoveAdminBot, cmdListaAdmins,
    cmdListaId, cmdListaJogadores, cmdConsultaId,
    cmdBanir, cmdPromoverGrupo, cmdRebaixarGrupo, cmdStats, cmdAddTabela,
} from './commands/admin/adminCmds.js';
import { commandLoja, commandCriarLoja, commandComprar, commandAddItem } from './commands/lojas/shopCmds.js';
import { commandPLC, commandUpdateLuta, commandFinalizarLuta, commandHistoricoLutas } from './commands/lutas/plc.js';
import {
    commandVT, commandSC, commandAtacar, commandDefender,
    commandUsarCard, commandFugir,
} from './services/ia/batalha.js';
import { commandLerCards, commandMeusCards, commandDeletarCard } from './services/cards/cards.js';
import { detectarFicha, processarFicha }  from './services/recrutamento/recrutamento.js';
import { commandAnuncio, commandRankingIenes, commandRankingXp, commandId, commandPing } from './commands/sistema/sistema.js';
import { MENU_GERAL, MENU_ADMIN, MENU_NTEI } from './commands/sistema/menus.js';
import db from './database/connection.js';

// ══════════════════════════════════════════════════════════
//   CONFIGURAÇÕES
// ══════════════════════════════════════════════════════════
const OWNER_NUMBER = process.env.OWNER_NUMBER || 'SEU_NUMERO_AQUI';
const OWNER_JID    = `${OWNER_NUMBER}@s.whatsapp.net`;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

// ══════════════════════════════════════════════════════════
//   INICIALIZAÇÃO & MIGRAÇÕES DE SEGURANÇA
// ══════════════════════════════════════════════════════════
runAllMigrations();
iniciarBackupAutomatico();

// Garante que a coluna de texto do inventário e a data existem na tabela jogadores
try { db.prepare('ALTER TABLE jogadores ADD COLUMN inventario TEXT DEFAULT ""').run(); } catch(e) {}
try { db.prepare('ALTER TABLE jogadores ADD COLUMN atualizado_em TEXT DEFAULT ""').run(); } catch(e) {}

// Garante que a tabela da loja (itens_loja) e suas colunas estejam criadas
try {
    db.prepare(`
        CREATE TABLE IF NOT EXISTS itens_loja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE,
            preco INTEGER,
            moeda TEXT,
            restric_raca TEXT DEFAULT "Ambos",
            descricao TEXT
        )
    `).run();
} catch(e) {}

// ══════════════════════════════════════════════════════════
//   CONEXÃO
// ══════════════════════════════════════════════════════════
let tentativas = 0;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const { version }          = await fetchLatestBaileysVersion();
    const makeSocket           = makeWASocket.default || makeWASocket;

    const sock = makeSocket({
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        browser: Browsers.ubuntu('Chrome'),
        generateHighQualityLinkPreview: false,
        getMessage: async () => ({ conversation: '' }),
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 500,
    });

    sock.ev.on('creds.update', saveCreds);

    // ─── EMPARELHAMENTO ──────────────────────────────────
    if (!sock.authState.creds.registered) {
        logger.info('Aguardando conexão estabilizar... (10s)');
        await delay(10000);
        console.log('\n🍊 ═══════════════════════════════════════ 🍊');
        console.log('   KIMETSU NEW AGE 4.0 — SISTEMA DE PAREAMENTO');
        console.log('🍊 ═══════════════════════════════════════ 🍊\n');
        let phoneNumber = await question('Digite o número WhatsApp do Bot (Ex: 5511999999999): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            try {
                await delay(2000);
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 CÓDIGO DE PAREAMENTO: \x1b[32m${code}\x1b[0m`);
                console.log('📱 WhatsApp → Aparelhos Conectados → Conectar com número\n');
            } catch (e) {
                logger.error('Erro ao gerar código. Execute npm start novamente.');
                process.exit(1);
            }
        }
    }

    // ─── EVENTOS DE CONEXÃO ──────────────────────────────
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            tentativas = 0;
            logger.success('🍊 Kimetsu New Age 4.0 — BOT CONECTADO!');
            realizarBackup();
        }
        if (connection === 'close') {
            const statusCode  = lastDisconnect?.error?.output?.statusCode;
            const loggedOut   = statusCode === DisconnectReason.loggedOut;
            logger.warn(`Conexão encerrada. Código: ${statusCode}`);
            if (loggedOut) {
                logger.error('Sessão expirada! Delete a pasta auth_info_baileys e reinicie.');
                try { fs.rmSync('auth_info_baileys', { recursive: true }); } catch (_) {}
                process.exit(0);
            }
            tentativas++;
            const espera = Math.min(tentativas * 3000, 30000);
            logger.info(`Reconectando em ${espera / 1000}s... (tentativa ${tentativas})`);
            setTimeout(connectToWhatsApp, espera);
        }
    });

    // ══════════════════════════════════════════════════════
    //   PROCESSAMENTO DE MENSAGENS
    // ══════════════════════════════════════════════════════
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            try {
                if (!msg.message)         continue;
                if (msg.key.fromMe)       continue;

                const remoteJid = msg.key.remoteJid;
                const sender    = msg.key.participant || remoteJid;
                const text      = extractText(msg);
                const isGroup   = remoteJid?.endsWith('@g.us') ?? false;
                const nivel      = getNivel(sender, OWNER_JID);

                if (!text) continue;
                logger.debug(`[MSG] ${sender.split('@')[0]}: "${text.substring(0, 80)}"`);

                // ── ANTI-FLOOD ──────────────────────────
                if (nivel === 'user') {
                    const flood = checkFlood(sender);
                    if (flood.bloqueado) {
                        if (flood.novo) {
                            flood.set?.();
                            await sock.sendMessage(remoteJid, {
                                text: `⚠️ @${sender.split('@')[0]} você está enviando mensagens muito rápido!\nBloqueado por *${flood.restante} minuto(s)*.`,
                                mentions: [sender]
                            });
                        }
                        continue;
                    }
                }

                // ── ANTI-LINK (grupos) ──────────────────
                if (isGroup && nivel === 'user' && LINK_REGEX.test(text)) {
                    await sock.sendMessage(remoteJid, {
                        text: `🚫 @${sender.split('@')[0]} links não são permitidos!`,
                        mentions: [sender]
                    });
                    await sock.sendMessage(remoteJid, { delete: msg.key });
                    try { await sock.groupParticipantsUpdate(remoteJid, [sender], 'remove'); } catch (_) {}
                    continue;
                }

                const textLow = text.toLowerCase().trim();

                // ══════════════════════════════════════════
                //   FICHA DE RECRUTAMENTO
                // ══════════════════════════════════════════
                if (detectarFicha(text)) {
                    await processarFicha(sock, remoteJid, sender, text);
                    continue;
                }

                // ══════════════════════════════════════════
                //   ESCOLHER RAÇA
                // ══════════════════════════════════════════
                if (textLow.startsWith('/escolher ra')) {
                    const racaEsc = text.replace(/\/escolher\s+ra[çc]a\s*/i, '').trim().toLowerCase();
                    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
                    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Sem perfil! Envie a ficha primeiro.` }); continue; }
                    if (j.raca && j.raca !== 'Indefinida') {
                        await sock.sendMessage(remoteJid, { text: `❌ Você já escolheu a raça *${j.raca}*!` }); continue;
                    }
                    const racas = { 'humano': '👱‍♂️ Humano', 'oni': '👹 Oni' };
                    const racaFinal = racas[racaEsc];
                    if (!racaFinal) {
                        await sock.sendMessage(remoteJid, { text: `❌ Raça inválida!\n\n👱‍♂️ */escolher raça Humano*\n👹 */escolher raça Oni*` }); continue;
                    }
                    db.prepare(`UPDATE jogadores SET raca = ?, atualizado_em = datetime('now','localtime') WHERE jid = ?`).run(racaFinal, sender);
                    await sock.sendMessage(remoteJid, {
                        text: `✅ @${sender.split('@')[0]} sua raça foi definida como *${racaFinal}*!\nUse */perfil* para ver sua ficha.`,
                        mentions: [sender]
                    });
                    continue;
                }

                // ─── ROTEADOR DE COMANDOS ──────────────────
                const [cmd, ...argsParts] = text.split(' ');
                const args = argsParts.join(' ');
                const cmdL = cmd.toLowerCase();

                switch (cmdL) {

                    // ── MENUS ──────────────────────────────
                    case '/menu': case '/start': case '/ajuda': case '/help':
                        await sock.sendMessage(remoteJid, { text: MENU_GERAL }); break;

                    case '/menuadmin': case '/admin':
                        if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); break; }
                        await sock.sendMessage(remoteJid, { text: MENU_ADMIN }); break;

                    case '/ntei': case '/menuntei': case '/dono':
                        if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Restrito ao dono.` }); break; }
                        await sock.sendMessage(remoteJid, { text: MENU_NTEI }); break;

                    // ── PERFIL & RPG ────────────────────────
                    case '/id':          await commandId(sock, remoteJid, sender); break;
                    case '/perfil':      await commandPerfil(sock, remoteJid, sender); break;
                    case '/inventario':  await commandInventario(sock, remoteJid, sender); break;
                    case '/salvarinventario': await commandSalvarInventario(sock, remoteJid, sender, args); break;
                    case '/tecnicas':    await commandTecnicas(sock, remoteJid, sender); break; 
                    case '/familias':    await commandFamilias(sock, remoteJid); break;
                    case '/escolherfamilia': await commandEscolherFamilia(sock, remoteJid, sender, args); break;

                    // ── ECONOMIA ───────────────────────────
                    case '/transferir':  await commandTransferir(sock, remoteJid, sender, args); break;
                    case '/removertransferencia': await commandRemoverTransferencia(sock, remoteJid, sender, nivel, args); break;
                    case '/extrato':     await commandExtrato(sock, remoteJid, sender); break;

                    // ── ADMIN: ECONOMIA ────────────────────
                    case '/addienes':    await cmdAddIenes(sock, remoteJid, msg, nivel, args); break;
                    case '/rmienes':     await cmdRmIenes(sock, remoteJid, msg, nivel, args); break;
                    case '/addeng':      await cmdAddEng(sock, remoteJid, msg, nivel, args); break;
                    case '/rmeng':       await cmdRmEng(sock, remoteJid, msg, nivel, args); break;
                    case '/addfichas':   await cmdAddFichas(sock, remoteJid, msg, nivel, args); break;
                    case '/rmfichas':    await cmdRmFichas(sock, remoteJid, msg, nivel, args); break;
                    case '/addxp':       await cmdAddXp(sock, remoteJid, msg, nivel, args); break;
                    case '/rmxp':        await cmdRmXp(sock, remoteJid, msg, nivel, args); break;
                    case '/addtabela':   await cmdAddTabela(sock, remoteJid, nivel, args); break;

                    // ── ADMIN: RPG ─────────────────────────
                    case '/setpatente':  await cmdSetPatente(sock, remoteJid, msg, nivel, args); break;
                    case '/resetusuario': await cmdResetUsuario(sock, remoteJid, msg, nivel); break;
                    case '/resetraca':   await cmdResetRaca(sock, remoteJid, msg, nivel); break;
                    case '/addadminbot': await cmdAddAdminBot(sock, remoteJid, msg, nivel); break;
                    case '/removeadminbot': await cmdRemoveAdminBot(sock, remoteJid, msg, nivel); break;
                    case '/listaadmins': await cmdListaAdmins(sock, remoteJid, nivel); break;
                    case '/listaid':     await cmdListaId(sock, remoteJid, nivel); break;
                    case '/listajogadores': await cmdListaJogadores(sock, remoteJid); break;
                    case '/consultaid':  await cmdConsultaId(sock, remoteJid, args); break;

                    // ── ADMIN: GRUPO ───────────────────────
                    case '/banir':       await cmdBanir(sock, remoteJid, msg, nivel); break;
                    case '/promover':    await cmdPromoverGrupo(sock, remoteJid, msg, nivel); break;
                    case '/rebaixar':    await cmdRebaixarGrupo(sock, remoteJid, msg, nivel); break;

                    // ── LOJAS ──────────────────────────────
                    case '/loja':        await commandLoja(sock, remoteJid, 'IENES'); break;
                    case '/lojafichas':  await commandLoja(sock, remoteJid, 'FICHAS'); break;
                    case '/lojaeng':     await commandLoja(sock, remoteJid, 'ENGRENAGENS'); break;
                    case '/criarloja':   await commandCriarLoja(sock, remoteJid, nivel, args); break;
                    case '/comprar':     await commandComprar(sock, remoteJid, sender, args); break;
                    case '/additem':     await commandAddItem(sock, remoteJid, nivel, args); break;

                    // ── LUTAS PLC ──────────────────────────
                    case '/plc':         await commandPLC(sock, remoteJid, nivel, args); break;
                    case '/updateluta':  await commandUpdateLuta(sock, remoteJid, nivel, args); break;
                    case '/finalizarluta': await commandFinalizarLuta(sock, remoteJid, nivel, args); break;
                    case '/historicolutas': await commandHistoricoLutas(sock, remoteJid); break;

                    // ── IA / VT / SC ───────────────────────
                    case '/vt':          await commandVT(sock, remoteJid, sender, args || 'medio'); break;
                    case '/sc':          await commandSC(sock, remoteJid, sender); break;
                    case '/atacar':      await commandAtacar(sock, remoteJid, sender); break;
                    case '/defender':    await commandDefender(sock, remoteJid, sender); break;
                    case '/usarcard':    await commandUsarCard(sock, remoteJid, sender, args); break;
                    case '/fugir':       await commandFugir(sock, remoteJid, sender); break;

                    // ── CARDS ──────────────────────────────
                    case '/lercard': case '/lercards': await commandLerCards(sock, remoteJid, sender, args || text); break;
                    case '/meuscards':   await commandMeusCards(sock, remoteJid, sender); break;
                    case '/deletarcard': await commandDeletarCard(sock, remoteJid, sender, args); break;

                    // ── SISTEMA ────────────────────────────
                    case '/ping':        await commandPing(sock, remoteJid); break;
                    case '/stats':       await cmdStats(sock, remoteJid, nivel); break;
                    case '/anuncio':     await commandAnuncio(sock, remoteJid, sender, nivel, args); break;
                    case '/rankingienes': await commandRankingIenes(sock, remoteJid); break;
                    case '/rankingxp':   await commandRankingXp(sock, remoteJid); break;

                    // ── ADDFAMILIA (admin) ─────────────────
                    case '/addfamilia': {
                        if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); break; }
                        const [nomeFam, descFam = ''] = args.split('|').map(p => p.trim());
                        if (!nomeFam) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */addfamilia Nome | Descrição*` }); break; }
                        try {
                            db.prepare(`INSERT INTO familias (nome, descricao) VALUES (?, ?)`).run(nomeFam, descFam);
                            await sock.sendMessage(remoteJid, { text: `✅ Família *${nomeFam}* adicionada!` });
                        } catch (e) {
                            await sock.sendMessage(remoteJid, { text: `❌ Família *${nomeFam}* já existe!` });
                        }
                        break;
                    }

                    // ── BROADCAST (NTEi) ───────────────────
                    case '/broadcast': {
                        if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); break; }
                        if (!args) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */broadcast [mensagem]*` }); break; }
                        await sock.sendMessage(remoteJid, { text: `📢 *BROADCAST ENVIADO:*\n\n${args}` });
                        break;
                    }

                    // ── COMANDOS COM / MAS NÃO RECONHECIDOS ─
                    default: {
                        if (cmdL.startsWith('/')) {
                            await sock.sendMessage(remoteJid, {
                                text: `⚠️ Este comando ainda não foi implementado.\n\nUse */menu* para ver os comandos disponíveis.`
                            });
                        }
                        else if (text.includes('Nome:') && (text.includes('Tipo:') || text.includes('Dano:'))) {
                            await commandLerCards(sock, remoteJid, sender, text);
                        }
                        break;
                    }
                }

            } catch (err) {
                logger.error(`Erro ao processar mensagem: ${err.message}\n${err.stack}`);
                try {
                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `❌ Ocorreu um erro interno. Tente novamente.\n\n_Detalhe: ${err.message}_`
                    });
                } catch (_) {}
            }
        }
    });

    return sock;
}

// ══════════════════════════════════════════════════════════
//   INICIAR
// ══════════════════════════════════════════════════════════
console.log('\n🍊 ══════════════════════════════════════════ 🍊');
console.log('      KIMETSU NEW AGE 4.0 — Iniciando...');
console.log('🍊 ══════════════════════════════════════════ 🍊\n');

connectToWhatsApp().catch(e => {
    logger.error(`Erro fatal: ${e.message}`);
    process.exit(1);
});

// ─── TRATAMENTO DE ERROS NÃO CAPTURADOS ─────────────────
process.on('uncaughtException',  (e) => logger.error(`UncaughtException: ${e.message}`));
process.on('unhandledRejection', (e) => logger.error(`UnhandledRejection: ${e}`));
