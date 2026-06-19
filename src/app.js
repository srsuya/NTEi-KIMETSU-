import makeWASocket, { useMultiFileAuthState, DisconnectReason, delay, Browsers } from '@whiskeysockets/baileys'; // AJUSTADO: Importou o Browsers
import pino from 'pino';
import readline from 'readline';
import { runMigrations } from './database/migrations/init.js';
import { runShopMigrations } from './database/migrations/shop_init.js';
import db from './database/connection.js';

// IMPORTS DOS GRUPOS DE COMANDOS E MIDDLEWARES
import { commandPerfil } from './commands/rpg/perfil.js';
import { authMiddleware } from './middleware/auth.js';
import { commandLoja, commandComprar } from './commands/shop/shopCmds.js';
import { commandAdminManager } from './commands/admin/adminCmds.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

runMigrations();
runShopMigrations();

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const makeSocket = makeWASocket.default || makeWASocket;

    const sock = makeSocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Desativa QR code para usar o pareamento por texto
        auth: state,
        browser: Browsers.ubuntu('Chrome') // CORREÇÃO CRÍTICA: Corrigido para o padrão aceito pelo WhatsApp
    });

    // Salva as credenciais sempre que atualizadas
    sock.ev.on('creds.update', saveCreds);

    // SISTEMA DE PAREAMENTO SEQUENCIAL (AJUSTADO PARA DAR TEMPO DE CONECTAR)
    if (!sock.authState.creds.registered) {
        console.log("\n🍊 [Tangerina-Bot] AGUARDANDO CONEXÃO ESTABILIZAR... (10s) 🍊\n");
        await delay(10000); // Dá 10 segundos para abrir os canais antes de pedir o código
        
        console.log("🍊 [Tangerina-Bot] SISTEMA DE PAREAMENTO POR TEXTO 🍊\n");
        let phoneNumber = await question('Digite o número do WhatsApp do Bot (Ex: 5511999999999): ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        if (phoneNumber) {
            try {
                await delay(2000); // Margem de segurança final
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n🔑 SEU CÓDIGO DO WHATSAPP: \x1b[32m${code}\x1b[0m\n`);
                console.log("Abra o WhatsApp -> Aparelhos Conectados -> Conectar com número, e digite o código acima!\n");
            } catch (error) {
                console.error("Erro ao gerar o código. Digite 'npm start' para tentar novamente.");
            }
        }
    }

    // LISTENER DE CONEXÃO
    sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
        if (connection === 'open') {
            console.log('🍊 Tangerina Bot conectado com sucesso no WhatsApp!');
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        }
    });

    // GERENCIADOR DE MENSAGENS (RPG)
    sock.ev.on('messages.upsert', async m => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const sender = msg.key.participant || remoteJid;

        // SISTEMA DE RECRUTAMENTO AUTOMÁTICO
        if (text.includes('📃 Ficha de Recrutamento')) {
            try {
                let SampleCheck = await db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
                if (SampleCheck) {
                    await sock.sendMessage(remoteJid, { text: `⚠️ Você já possui um perfil cadastrado! Use /perfil` });
                    return;
                }
                const lines = text.split('\n');
                const nickLinha = lines.find(l => l.toLowerCase().includes('nick:'));
                const familiaLinha = lines.find(l => l.toLowerCase().includes('família:') || l.toLowerCase().includes('familia:'));
                const vilaLinha = lines.find(l => l.toLowerCase().includes('vila:'));

                const nick = nickLinha ? nickLinha.split(':')[1].trim() : null;
                const familia = familiaLinha ? familiaLinha.split(':')[1].trim() : 'Nenhuma';
                const vila = vilaLinha ? vilaLinha.split(':')[1].trim() : 'Nenhuma';

                if (!nick) {
                    await sock.sendMessage(remoteJid, { text: `❌ Erro ao ler a ficha. Certifique-se de preencher o campo 'Nick:' corretamente.` });
                    return;
                }

                const resultadoMaxId = await db.prepare('SELECT MAX(id_rpg) as id FROM jogadores').get();
                const novoIdRpg = (resultadoMaxId && resultadoMaxId.id) ? resultadoMaxId.id + 1 : 1001;

                await db.prepare(`
                    INSERT INTO jogadores (jid, id_rpg, nick, raca, patente, familia, vila, hp, max_hp, chakra, max_chakra, xp, ienes, fichas)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 100, 100, 100, 100, 0, 0, 0)
                `).run(sender, novoIdRpg, nick, 'Humano', '⏺️ Cidadão', familia, vila);

                const mensagemSucesso = `🍊 *TANGERINA BOT RPG* 🍊\n\n` +
                                        `🎉 *RECRUTAMENTO CONCLUÍDO COM SUCESSO!*\n\n` +
                                        `🆔 *ID RPG:* ${novoIdRpg}\n` +
                                        `👤 *Nick:* ${nick}\n` +
                                        `🧬 *Raça Inicial:* 👱形‍♂️ Humano\n` +
                                        `🎖️ *Patente Inicial:* ⏺️ Cidadão\n` +
                                        `🎴 *Família:* ${familia}\n` +
                                        `🌅 *Vila:* ${vila}\n\n` +
                                        `Digite */menu* para ver suas opções de jogo!`;

                await sock.sendMessage(remoteJid, { text: mensagemSucesso });
            } catch (error) {
                console.error("Erro crítico no recrutamento automático:", error);
                await sock.sendMessage(remoteJid, { text: `❌ Ocorreu um erro interno ao processar sua ficha.` });
            }
            return;
        }

        // COMANDOS DO MENU E LOJA
        if (text === '/menu') {
            await sock.sendMessage(remoteJid, { 
                text: `🍊 *TANGERINA BOT RPG* 🍊\n\n` +
                      ` Comandos Disponíveis:\n` +
                      `👉 */perfil* - Veja sua ficha de jogador\n` +
                      `👉 */loja* - Abre a loja de Ienes\n` +
                      `👉 */lojafichas* - Abre a loja de Fichas\n` +
                      `👉 */comprar [nome]* - Compra um item da loja`
            });
        }

        if (text === '/perfil') await commandPerfil(sock, remoteJid, sender);
        if (text === '/loja') await commandLoja(sock, remoteJid, 'IENES');
        if (text === '/lojafichas') await commandLoja(sock, remoteJid, 'FICHAS');
        if (text.startsWith('/comprar')) {
            const itemParaComprar = text.replace('/comprar', '').trim();
            await commandComprar(sock, remoteJid, sender, itemParaComprar);
        }

        // COMANDOS ADMINISTRATIVOS
        if (text.startsWith('/addienes') || text.startsWith('/addfichas' ) || text.startsWith('/setpatente')) {
            const { isAllowedAdminCmd } = await authMiddleware(sock, msg, remoteJid, sender);
            if (!isAllowedAdminCmd) {
                await sock.sendMessage(remoteJid, { text: '❌ Permissão negada. Comando restrito a administradores.' });
                return;
            }
            await commandAdminManager(sock, remoteJid, text);
        }
    });
}

connectToWhatsApp().catch(err => console.error("Erro crítico ao iniciar o bot:", err));
