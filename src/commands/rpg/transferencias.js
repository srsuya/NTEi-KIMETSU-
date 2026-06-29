import db from '../../database/connection.js';
import { fmtNum, logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── TRANSFERIR ───────────────────────────────────────────
// Uso: /transferir id:1001 1500 Motivo
export async function commandTransferir(sock, remoteJid, sender, args) {
    const remetente = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!remetente) { await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil cadastrado!` }); return; }

    // Parsear argumentos
    const match = args.match(/id:(\d+)\s+(\d+)\s*(.*)/i);
    if (!match) {
        await sock.sendMessage(remoteJid, { text: `❌ Formato: */transferir id:1001 1500 Motivo*` }); return;
    }
    const [, idDest, valorStr, motivo] = match;
    const valor = parseInt(valorStr);

    const destinatario = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(parseInt(idDest));
    if (!destinatario) { await sock.sendMessage(remoteJid, { text: `❌ Jogador ID *${idDest}* não encontrado!` }); return; }
    if (destinatario.jid === sender) { await sock.sendMessage(remoteJid, { text: `❌ Você não pode transferir para si mesmo!` }); return; }
    if (valor <= 0) { await sock.sendMessage(remoteJid, { text: `❌ Valor inválido!` }); return; }
    if (remetente.ienes < valor) {
        await sock.sendMessage(remoteJid, { text: `❌ Saldo insuficiente!\nSeu saldo: *${fmtNum(remetente.ienes)}* ienes` }); return;
    }

    // Executar transação
    const transacao = db.transaction(() => {
        db.prepare(`UPDATE jogadores SET ienes = ienes - ? WHERE jid = ?`).run(valor, sender);
        db.prepare(`UPDATE jogadores SET ienes = ienes + ? WHERE jid = ?`).run(valor, destinatario.jid);
        const result = db.prepare(`INSERT INTO transferencias (remetente, destinatario, valor, motivo, tipo)
            VALUES (?, ?, ?, ?, 'ienes')`).run(sender, destinatario.jid, valor, motivo || 'Sem motivo');
        return result.lastInsertRowid;
    });

    const transId = transacao();
    logDB('transferencia', sender, destinatario.jid, `ID:${transId} valor:${valor} motivo:${motivo}`);

    const now = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
   💸 *FICHA DE TRANSFERÊNCIA* 💸

🆔 ID Trans: *#${transId}*
📅 Data: *${now}*
📤 Remetente: *${remetente.nick}* (ID: ${remetente.id_rpg})
📥 Destinatário: *${destinatario.nick}* (ID: ${destinatario.id_rpg})
💰 Valor: *${fmtNum(valor)} ienes*
📝 Motivo: *${motivo || 'Sem motivo'}*

✅ Transferência realizada com sucesso!
${BORDA_BOT}`
    });
}

// ─── REMOVER TRANSFERÊNCIA ───────────────────────────────
export async function commandRemoverTransferencia(sock, remoteJid, sender, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }

    const id = parseInt(args.trim());
    if (!id) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */removertransferencia [id]*` }); return; }

    const trans = db.prepare('SELECT * FROM transferencias WHERE id = ?').get(id);
    if (!trans) { await sock.sendMessage(remoteJid, { text: `❌ Transferência #${id} não encontrada!` }); return; }
    if (trans.cancelada) { await sock.sendMessage(remoteJid, { text: `❌ Esta transferência já foi cancelada!` }); return; }

    db.transaction(() => {
        db.prepare(`UPDATE jogadores SET ienes = ienes + ? WHERE jid = ?`).run(trans.valor, trans.remetente);
        db.prepare(`UPDATE jogadores SET ienes = ienes - ? WHERE jid = ?`).run(trans.valor, trans.destinatario);
        db.prepare(`UPDATE transferencias SET cancelada = 1 WHERE id = ?`).run(id);
    })();

    logDB('cancelamento_trans', sender, '', `Trans #${id} cancelada`);
    await sock.sendMessage(remoteJid, { text: `✅ Transferência *#${id}* cancelada! Valores devolvidos.` });
}

// ─── EXTRATO ─────────────────────────────────────────────
export async function commandExtrato(sock, remoteJid, sender) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Sem perfil!` }); return; }

    const trans = db.prepare(`
        SELECT t.*, j1.nick as nick_rem, j2.nick as nick_dest
        FROM transferencias t
        LEFT JOIN jogadores j1 ON j1.jid = t.remetente
        LEFT JOIN jogadores j2 ON j2.jid = t.destinatario
        WHERE (t.remetente = ? OR t.destinatario = ?) AND t.cancelada = 0
        ORDER BY t.id DESC LIMIT 10
    `).all(sender, sender);

    if (!trans.length) { await sock.sendMessage(remoteJid, { text: `📭 Nenhuma transferência encontrada!` }); return; }

    let lista = trans.map(t => {
        const entrada = t.destinatario === sender;
        const sinal = entrada ? '📥+' : '📤-';
        return `${sinal}${fmtNum(t.valor)} | ${entrada ? t.nick_rem : t.nick_dest} | ${t.motivo || '-'} | #${t.id}`;
    }).join('\n');

    await sock.sendMessage(remoteJid, {
        text: `${BORDA_TOPO}\n${TITULO}\n   📊 *EXTRATO DE ${j.nick}* (últimas 10)\n\n${lista}\n\n💰 Saldo atual: *${fmtNum(j.ienes)} ienes*\n${BORDA_BOT}`
    });
}
