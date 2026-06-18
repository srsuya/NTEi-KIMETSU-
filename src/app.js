import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import { runMigrations } from './database/migrations/init.js';
import db from './database/connection.js';

// 1. Inicializa as tabelas do banco de dados SQLite
runMigrations();

async function connectToWhatsApp() {
    // Configura a pasta onde vai guardar a sessão do WhatsApp conectado
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    const sock = makeWASocket.default({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: true, // Isso fará o QR Code aparecer quando você ligar o bot
        auth: state
    });

    // Salva as credenciais toda vez que o estado mudar
    sock.ev.on('creds.update', saveCreds);

    // Gerencia a conexão (se caiu, reconecta automaticamente)
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

    // OUVINTE DE MENSAGENS: Aqui o bot lê e responde o que chega no Zap
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
                // Verifica se o jogador já existe no banco de dados para não duplicar
                let jogadorExistente = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
                
                if (jogadorExistente) {
                    await sock.sendMessage(remoteJid, { text: `⚠️ Você já possui um perfil cadastrado! Use /perfil` });
                    return;
                }

                // Quebra o texto enviado em linhas para analisar
                const linhas = text.split('\n');

                // Procura as palavras-chave da ficha
                const nickLinha = linhas.find(l => l.toLowerCase().includes('nick:'));
                const familiaLinha = linhas.find(l => l.toLowerCase().includes('família:') || l.toLowerCase().includes('familia:'));
                const vilaLinha = linhas.find(l => l.toLowerCase().includes('vila:'));

                // Extrai os valores reais digitados após os dois pontos ":"
                const nick = nickLinha ? nickLinha.split(':')[1].trim() : null;
                const familia = familiaLinha ? familiaLinha.split(':')[1].trim() : 'Nenhuma';
                const vila =
