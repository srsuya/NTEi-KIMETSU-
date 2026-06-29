// src/commands/rpg/inventario.js
import db from '../../database/connection.js';
import { logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

/**
 * Exibe o inventário do jogador formatado em texto
 */
export async function commandInventario(sock, remoteJid, sender) {
    try {
        // Busca o jogador no banco de dados completo
        const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
        if (!j) {
            await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil cadastrado!` });
            return;
        }

        // Se o inventário estiver vazio, nulo ou apenas espaços, define como '_vazio_'
        const inv = j.inventario?.trim() || '_vazio_';

        // Envia a mensagem usando as bordas e estilos visuais do seu RPG
        await sock.sendMessage(remoteJid, {
            text: 
`${BORDA_TOPO}
${TITULO}
      🎒 *INVENTÁRIO DE ${j.nick.toUpperCase()}* 🎒

${inv}
${BORDA_BOT}`
        });
    } catch (error) {
        console.error("Erro no comando inventario:", error);
        await sock.sendMessage(remoteJid, { text: `❌ Ocorreu um erro ao carregar o seu inventário.` });
    }
}

/**
 * Permite que um administrador ou sistema salve manualmente um texto no inventário
 */
export async function commandSalvarInventario(sock, remoteJid, sender, texto) {
    try {
        const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
        if (!j) {
            await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil cadastrado!` });
            return;
        }
        if (!texto) {
            await sock.sendMessage(remoteJid, { text: `❌ Use: */salvarinventario [conteúdo]*` });
            return;
        }

        // Atualiza o bloco de texto do inventário e a data de modificação local
        db.prepare(`UPDATE jogadores SET inventario = ?, atualizado_em = datetime('now','localtime') WHERE jid = ?`)
          .run(texto, sender);

        // Registra a alteração nos logs de segurança do banco
        logDB('inventario', sender, sender, `Salvo: ${texto.substring(0, 50)}`);

        await sock.sendMessage(remoteJid, { text: `✅ Inventário de *${j.nick}* atualizado com sucesso!` });
    } catch (error) {
        console.error("Erro ao salvar inventario:", error);
        await sock.sendMessage(remoteJid, { text: `❌ Ocorreu um erro ao tentar salvar o inventário.` });
    }
}
