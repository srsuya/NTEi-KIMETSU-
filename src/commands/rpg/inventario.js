// src/commands/rpg/inventario.js
import db from '../../database/connection.js';

export async function commandInventario(sock, remoteJid, sender) {
    // 1. Verifica se o jogador existe
    const jogador = db.prepare('SELECT nick FROM jogadores WHERE jid = ?').get(sender);
    if (!jogador) {
        await sock.sendMessage(remoteJid, { text: '❌ Você não possui um registro! Envie sua ficha primeiro.' });
        return;
    }

    // 2. Busca os itens que o jogador comprou (tabela 'compras' que está na sua migração)
    // Agrupamos por item para mostrar a quantidade total de cada um
    const itens = db.prepare(`
        SELECT item_nome, SUM(quantidade) as total 
        FROM compras 
        WHERE jogador_jid = ? 
        GROUP BY item_nome
    `).all(sender);

    let msgInventario = `🎒 *INVENTÁRIO DE ${jogador.nick.toUpperCase()}* 🎒\n`;
    msgInventario += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    if (itens.length === 0) {
        msgInventario += `📦 *Seu inventário está totalmente vazio!*\n`;
        msgInventario += `Visite a loja usando */loja* para comprar equipamentos.\n`;
    } else {
        itens.forEach(item => {
            msgInventario += `🔹 *${item.item_nome}* x${item.total}\n`;
        });
    }
    
    msgInventario += `━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(remoteJid, { text: msgInventario });
}
