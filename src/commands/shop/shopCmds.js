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
