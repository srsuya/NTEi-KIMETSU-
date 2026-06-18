import db from '../database/connection.js';
import { EconomyService } from './economy.js';

export class ShopService {
    static listarItens(moeda) {
        return db.prepare('SELECT * FROM itens_loja WHERE moeda = ?').all(moeda);
    }

    static comprarItem(jid, itemNome) {
        const transacao = db.transaction(() => {
            // 1. Pega os dados do jogador
            const jogador = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(jid);
            if (!jogador) throw new Error('Jogador não registrado.');

            // 2. Pega os dados do item da loja
            const item = db.prepare('SELECT * FROM itens_loja WHERE nome = ?').get(itemNome);
            if (!item) throw new Error('Item não encontrado na loja.');

            // 3. Validação de Restrição de Raça
            if (item.restricao_raca !== 'Ambos' && item.restricao_raca !== jogador.raca) {
                throw new Error(`Este item é exclusivo para a raça ${item.restricao_raca}.`);
            }

            // 4. Validação de Limites de Compra
            if (item.limite !== -1) {
                const jaComprado = db.prepare('SELECT SUM(quantidade) as total FROM compras WHERE jogador_jid = ? AND item_nome = ?').get(jid, itemNome);
                if (jaComprado && jaComprado.total >= item.limite) {
                    throw new Error(`Você já atingiu o limite de compra deste item (${item.limite}).`);
                }
            }

            // 5. Cobrança de Saldo via EconomyService
            const cobranca = EconomyService.alterarSaldo(jid, item.moeda, item.preco, 'REMOVE', `Compra de ${item.nome}`);
            if (!cobranca.success) throw new Error(cobranca.error || 'Saldo insuficiente.');

            // 6. Entrega do Item no Inventário do Jogador
            const itemInventario = db.prepare('SELECT * FROM inventario WHERE jogador_jid = ? AND item_nome = ?').get(jid, itemNome);
            if (itemInventario) {
                db.prepare('UPDATE inventario SET quantidade = quantidade + 1 WHERE id = ?').run(itemInventario.id);
            } else {
                db.prepare('INSERT INTO inventario (jogador_jid, item_nome, quantidade) VALUES (?, ?, 1)').run(jid, itemNome);
            }

            // 7. Registra no Histórico de Compras
            db.prepare('INSERT INTO compras (jogador_jid, item_nome, quantidade) VALUES (?, ?, 1)').run(jid, itemNome);
        });

        try {
            transacao();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
