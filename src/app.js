import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { runMigrations } from './database/migrations/init.js';
import { runShopMigrations } from './database/migrations/shop_init.js';
import db from './database/connection.js';

// IMPORTS DOS GRUPOS DE COMANDOS E MIDDLEWARES
import { commandPerfil } from './commands/rpg/perfil.js';
import { authMiddleware } from './middleware/auth.js';
import { commandLoja, commandComprar } from './commands/shop/shopCmds.js';
import { commandAdminManager } from './commands/admin/adminCmds.js';

// 1. Inicializa todas as tabelas do banco de dados (Jogadores + Loja)
runMigrations();
runShopMigrations();

async function connectToWhatsApp() {
    // Configura a pasta onde vai guardar a sessão do WhatsApp conectado
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket.default({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Faz o QR Code aparecer na tela do terminal quando ligar
        auth: state
    });

    // Salva as credenciais toda vez que o estado mudar
    sock.ev.on('creds.update', saveCreds);

    // Gerencia a conexão (se cair, reconecta automaticamente)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Conexão fechada. Reconectando...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('🍊 Tangerina Bot conectado com sucesso no WhatsApp!');
        }
    });

    // OUVINTE DE MENSAGENS: Aqui o bot lê e responde tudo no Zap
    sock.ev.on('messages.upsert', async m => {
        if (m.type !== 'notify') return;
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
        const sender = msg.key.participant || remoteJid; // Captura quem enviou (JID)

        // ========================================================
        // GATILHO: IDENTIFICAÇÃO AUTOMÁTICA DE RECRUTAS
        // ========================================================
        if (text.includes('📃 Ficha de Recrutamento')) {
            try {
                let jogadorExistente = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
                
                if (jogadorExistente) {
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

                const resultadoMaxId = db.prepare('SELECT MAX(id_rpg) as id FROM jogadores').get();
                const novoIdRpg = (resultadoMaxId && resultadoMaxId.id) ? resultadoMaxId.id + 1 : 1001;

                db.prepare(`
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
            return; // Encerra a execução aqui para esta mensagem
        }

        // ========================================================
        // SEÇÃO DE COMANDOS PÚBLICOS DO RPG
        // ========================================================
        
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

        if (text === '/perfil') {
            await commandPerfil(sock, remoteJid, sender);
        }

        if (text === '/loja') {
            await commandLoja(sock, remoteJid, 'IENES');
        }

        if (text === '/lojafichas') {
            await commandLoja(sock, remoteJid, 'FICHAS');
        }

        if (text.startsWith('/comprar')) {
            const itemParaComprar = text.replace('/comprar', '').trim();
            await commandComprar(sock, remoteJid, sender, itemParaComprar);
        }

        // ========================================================
        // SEÇÃO DE COMANDOS ADMINISTRATIVOS (PROTEGIDOS)
        // ========================================================
        if (text.startsWith('/addienes') || text.startsWith('/addfichas') || text.startsWith('/setpatente')) {
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
