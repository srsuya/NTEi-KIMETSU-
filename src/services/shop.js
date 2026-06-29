// src/services/shop.js
import db from '../database/connection.js';

export const ShopService = {
    listarItens(moeda) {
        return db.prepare('SELECT * FROM itens_loja WHERE moeda = ?').all(moeda);
    },

    comprarItem(sender, itemNome) {
        const item = db.prepare('SELECT * FROM itens_loja WHERE nome = ?').get(itemNome);
        if (!item) return { success: false, error: 'Este item não existe na loja.' };

        const jogador = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
        if (!jogador) return { success: false, error: 'Você não possui um registro.' };

        if (item.restricao_raca !== 'Ambos' && item.restricao_raca !== jogador.raca) {
            return { success: false, error: `Exclusivo para a raça ${item.restricao_raca}.` };
        }

        // Verifica o saldo
        if (item.moeda === 'IENES') {
            if (jogador.ienes < item.preco) return { success: false, error: `Ienes insuficientes. Preço: 💰 ${item.preco}` };
            db.prepare('UPDATE jogadores SET ienes = ienes - ? WHERE jid = ?').run(item.preco, sender);
        } else {
            if (jogador.fichas < item.preco) return { success: false, error: `Fichas insuficientes. Preço: 🎐 ${item.preco}` };
            db.prepare('UPDATE jogadores SET fichas = fichas - ? WHERE jid = ?').run(item.preco, sender);
        }

        // LÓGICA DO INVENTÁRIO EM TEXTO:
        // Pega o texto atual do inventário e adiciona o novo item que foi comprado numa linha abaixo
        let invAtual = jogador.inventario?.trim() || '';
        if (invAtual === '' || invAtual === '_vazio_') {
            invAtual = `🔹 ${item.nome}`;
        } else {
            invAtual = `${invAtual}\n🔹 ${item.nome}`;
        }

        // Salva o texto atualizado de volta no jogador
        db.prepare(`UPDATE jogadores SET inventario = ?, atualizado_em = datetime('now','localtime') WHERE jid = ?`)
          .run(invAtual, sender);

        return { success: true };
    }
};
