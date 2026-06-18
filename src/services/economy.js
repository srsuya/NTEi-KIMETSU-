import db from '../database/connection.js';

export class EconomyService {
    static alterarSaldo(jid, tipo, valor, operacao, descricao = '') {
        // Inicia uma transação segura no SQLite
        const transacao = db.transaction(() => {
            const jogador = db.prepare('SELECT ienes, fichas FROM jogadores WHERE jid = ?').get(jid);
            if (!jogador) throw new Error('Jogador não encontrado');

            let novoSaldo = 0;
            if (tipo === 'IENES') {
                novoSaldo = operacao === 'ADD' ? jogador.ienes + valor : jogador.ienes - valor;
                if (novoSaldo < 0) throw new Error('Saldo de Ienes insuficiente');
                db.prepare('UPDATE jogadores SET ienes = ? WHERE jid = ?').run(novoSaldo, jid);
            } else if (tipo === 'FICHAS') {
                novoSaldo = operacao === 'ADD' ? jogador.fichas + valor : jogador.fichas - valor;
                if (novoSaldo < 0) throw new Error('Saldo de Fichas insuficiente');
                db.prepare('UPDATE jogadores SET fichas = ? WHERE jid = ?').run(novoSaldo, jid);
            }

            // Registra no histórico financeiro para auditoria
            db.prepare(`
                INSERT INTO historico_financeiro (jogador_jid, tipo, valor, operacao, descricao)
                VALUES (?, ?, ?, ?, ?)
            `).run(jid, tipo, valor, operacao, descricao);
        });

        try {
            transacao();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
