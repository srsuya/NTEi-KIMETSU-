=== rpg/perfil.js ===
import db from '../../database/connection.js';

export async function commandPerfil(sock, remoteJid, sender) {
    // Garante que o JID seja buscado perfeitamente no simulador JSON
    const jogador = db.prepare('select * from jogadores where jid = ?').get(sender);

    if (!jogador) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Você não possui um registro!* Envie sua *📃 Ficha de Recrutamento* para começar.` 
        });
        return;
    }

    // Design Visual Limpo e Profissional no WhatsApp
    const fichaVisual = 
        `🍊 *STATUS DO GUERREIRO* 🍊\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Nick:* ${jogador.nick}\n` +
        `🆔 *ID RPG:* #${jogador.id_rpg}\n` +
        `🧬 *Raça:* ${jogador.raca === 'Humano' ? '👱🏻‍♂️ Humano' : '👹 Oni'}\n` +
        `🎖️ *Patente:* ${jogador.patente}\n` +
        `🏡 *Vila:* ${jogador.vila}\n` +
        `♌ *Família:* ${jogador.familia}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🩸 *HP:* [ ${jogador.hp} / ${jogador.max_hp} ]\n` +
        `⚡ *Chakra:* [ ${jogador.chakra} / ${jogador.max_chakra} ]\n` +
        `✨ *XP Atual:* ${jogador.xp}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *FINANÇAS* 💰\n` +
        `💵 *Ienes:* 💰 ${jogador.ienes}\n` +
        `🎐 *Fichas:* 🎐 ${jogador.fichas}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎒 *Inventário:* /inventario\n` +
        `⚔️ *Técnicas:* /tecnicas\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(remoteJid, { text: fichaVisual });
}
=== shop/shopCmds.js ===
import { ShopService } from '../../services/shop.js';

export async function commandLoja(sock, remoteJid, moeda = 'IENES') {
    const itens = ShopService.listarItens(moeda);
    const titulo = moeda === 'IENES' ? '💰 LOJA DE IENES' : '🎐 LOJA DE FICHAS';
    
    let menu = `🍊 *${titulo}* 🍊\n`;
    menu += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    menu += `Para adquirir, utilize: /comprar Nome do Item\n\n`;

    itens.forEach(item => {
        const limiteStr = item.limite === -1 ? 'Infinito' : `${item.limite}x`;
        menu += `🔹 *${item.nome}*\n`;
        menu += `» Preço: ${item.preco} ${item.moeda === 'IENES' ? '💰' : '🎐'}\n`;
        menu += `» Raça: ${item.restricao_raca}\n`;
        menu += `» Limite: ${limiteStr}\n`;
        menu += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    });

    await sock.sendMessage(remoteJid, { text: menu });
}

export async function commandComprar(sock, remoteJid, sender, itemNome) {
    if (!itemNome) {
        await sock.sendMessage(remoteJid, { text: '❌ Informe o nome do item. Exemplo: `/comprar 🎴 Brinco do Tanjiro`' });
        return;
    }

    const resultado = ShopService.comprarItem(sender, itemNome.trim());
    if (resultado.success) {
        await sock.sendMessage(remoteJid, { text: `🎉 Compra realizada com sucesso! O item *${itemNome}* foi enviado ao seu /inventario.` });
    } else {
        await sock.sendMessage(remoteJid, { text: `❌ Falha na compra: ${resultado.error}` });
    }
}

Ver connection.js e migrations
