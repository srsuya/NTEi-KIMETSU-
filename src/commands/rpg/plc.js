import db from '../../database/connection.js';
import { logDB, barHP, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── INICIAR LUTA PLC ────────────────────────────────────
// Uso: /plc id:1001 id:1002
export async function commandPLC(sock, remoteJid, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }

    const ids = [...args.matchAll(/id:(\d+)/gi)].map(m => parseInt(m[1]));
    if (ids.length < 2) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */plc id:1001 id:1002*` }); return; }

    const j1 = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(ids[0]);
    const j2 = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(ids[1]);
    if (!j1 || !j2) { await sock.sendMessage(remoteJid, { text: `❌ Um ou ambos os jogadores não encontrados!` }); return; }

    // Verificar se já há luta ativa
    const lutaAtiva = db.prepare(`
        SELECT * FROM lutas WHERE status = 'ativa'
        AND (jogador1 = ? OR jogador2 = ? OR jogador1 = ? OR jogador2 = ?)
    `).get(j1.jid, j1.jid, j2.jid, j2.jid);
    if (lutaAtiva) {
        await sock.sendMessage(remoteJid, { text: `❌ Um dos jogadores já está em uma luta ativa! (ID: #${lutaAtiva.id_luta})` }); return;
    }

    const luta = db.prepare(`
        INSERT INTO lutas (jogador1, jogador2, hp1, hp2, energia1, energia2, tipo)
        VALUES (?, ?, ?, ?, ?, ?, 'plc')
    `).run(j1.jid, j2.jid, j1.max_hp, j2.max_hp, 100, 100);

    const id_luta = luta.lastInsertRowid;
    logDB('luta_inicio', j1.jid, j2.jid, `PLC #${id_luta}`);

    await sock.sendMessage(remoteJid, {
        text: gerarPlacar(j1, j2, j1.max_hp, j2.max_hp, 100, 100, id_luta, 1)
    });
}

// ─── ATUALIZAR LUTA ──────────────────────────────────────
// /updateluta id_luta hp1:80 hp2:65 en1:70 en2:90
export async function commandUpdateLuta(sock, remoteJid, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }

    const idMatch = args.match(/^(\d+)/);
    if (!idMatch) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */updateluta [id] hp1:80 hp2:65*` }); return; }
    const id_luta = parseInt(idMatch[1]);
    const luta = db.prepare('SELECT * FROM lutas WHERE id_luta = ?').get(id_luta);
    if (!luta) { await sock.sendMessage(remoteJid, { text: `❌ Luta #${id_luta} não encontrada!` }); return; }
    if (luta.status !== 'ativa') { await sock.sendMessage(remoteJid, { text: `❌ Esta luta já foi finalizada!` }); return; }

    const hp1  = parseInt(args.match(/hp1:(\d+)/i)?.[1] ?? luta.hp1);
    const hp2  = parseInt(args.match(/hp2:(\d+)/i)?.[1] ?? luta.hp2);
    const en1  = parseInt(args.match(/en(?:ergia)?1:(\d+)/i)?.[1] ?? luta.energia1);
    const en2  = parseInt(args.match(/en(?:ergia)?2:(\d+)/i)?.[1] ?? luta.energia2);
    const turno = luta.turno + 1;

    // Verificar fim de luta
    let status = 'ativa', vencedor = '';
    if (hp1 <= 0 || hp2 <= 0) {
        status = 'finalizada';
        vencedor = hp1 <= 0 ? luta.jogador2 : luta.jogador1;
    }

    db.prepare(`UPDATE lutas SET hp1=?,hp2=?,energia1=?,energia2=?,turno=?,status=?,vencedor=?,
        finalizado_em = CASE WHEN ? = 'finalizada' THEN datetime('now','localtime') ELSE '' END
        WHERE id_luta=?`).run(hp1, hp2, en1, en2, turno, status, vencedor, status, id_luta);

    const j1 = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(luta.jogador1);
    const j2 = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(luta.jogador2);
    const j1MaxHp = j1?.max_hp || 100;
    const j2MaxHp = j2?.max_hp || 100;

    let texto = gerarPlacar(j1, j2, hp1, hp2, en1, en2, id_luta, turno);
    if (status === 'finalizada') {
        const vencJogador = db.prepare('SELECT nick FROM jogadores WHERE jid = ?').get(vencedor);
        texto += `\n\n🏆 *VENCEDOR: ${vencJogador?.nick || '?'}!*\n🎉 Luta #${id_luta} finalizada no turno ${turno}!`;
        logDB('luta_fim', vencedor, '', `PLC #${id_luta} turno ${turno}`);
    }
    await sock.sendMessage(remoteJid, { text: texto });
}

// ─── FINALIZAR LUTA ──────────────────────────────────────
export async function commandFinalizarLuta(sock, remoteJid, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const id = parseInt(args.trim());
    if (!id) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */finalizarluta [id]*` }); return; }
    db.prepare(`UPDATE lutas SET status='cancelada', finalizado_em=datetime('now','localtime') WHERE id_luta=?`).run(id);
    await sock.sendMessage(remoteJid, { text: `✅ Luta *#${id}* encerrada!` });
}

// ─── HISTÓRICO DE LUTAS ──────────────────────────────────
export async function commandHistoricoLutas(sock, remoteJid) {
    const lutas = db.prepare(`
        SELECT l.*, j1.nick as n1, j2.nick as n2, jv.nick as nv
        FROM lutas l
        LEFT JOIN jogadores j1 ON j1.jid = l.jogador1
        LEFT JOIN jogadores j2 ON j2.jid = l.jogador2
        LEFT JOIN jogadores jv ON jv.jid = l.vencedor
        ORDER BY l.id_luta DESC LIMIT 10
    `).all();
    if (!lutas.length) { await sock.sendMessage(remoteJid, { text: `📭 Nenhuma luta registrada.` }); return; }
    const lista = lutas.map(l =>
        `⚔️ #${l.id_luta} | *${l.n1}* vs *${l.n2}* | ${l.status} ${l.nv ? '| 🏆 ' + l.nv : ''}`
    ).join('\n');
    await sock.sendMessage(remoteJid, {
        text: `${BORDA_TOPO}\n${TITULO}\n  ⚔️ *HISTÓRICO DE LUTAS*\n\n${lista}\n${BORDA_BOT}`
    });
}

// ─── HELPER: GERAR PLACAR ────────────────────────────────
function gerarPlacar(j1, j2, hp1, hp2, en1, en2, id_luta, turno) {
    const j1MaxHp = j1?.max_hp || 100;
    const j2MaxHp = j2?.max_hp || 100;
    return `${BORDA_TOPO}
${TITULO}
   ⚔️ *PLACAR DA LUTA #${id_luta}* ⚔️   Turno: ${turno}

⚔️ *${j1?.nick || '?'}* (ID: ${j1?.id_rpg || '?'})
❤️ HP: ${Math.max(0, hp1)}/${j1MaxHp}  [${barHP(hp1, j1MaxHp)}]
⚡ Energia: ${en1}/100  [${barHP(en1, 100)}]

⚔️ *${j2?.nick || '?'}* (ID: ${j2?.id_rpg || '?'})
❤️ HP: ${Math.max(0, hp2)}/${j2MaxHp}  [${barHP(hp2, j2MaxHp)}]
⚡ Energia: ${en2}/100  [${barHP(en2, 100)}]

💬 Admin: */updateluta ${id_luta} hp1:XX hp2:XX en1:XX en2:XX*
${BORDA_BOT}`;
}
