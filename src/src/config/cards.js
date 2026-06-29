import db from '../../database/connection.js';
import { logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── LER CARDS ENVIADOS PELO USUÁRIO ─────────────────────
// Detecta automaticamente campos de cards no texto
export async function commandLerCards(sock, remoteJid, sender, texto) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil!` }); return; }

    const cardsExtraidos = extrairCards(texto);
    if (!cardsExtraidos.length) {
        await sock.sendMessage(remoteJid, {
            text: `❌ Nenhum card detectado!\n\nFormato esperado:\n\n*Nome:* [nome do card]\n*Tipo:* [ataque/defesa/suporte]\n*Dano:* [número]\n*Buff:* [número]\n*Debuff:* [número]\n*Descrição:* [texto]\n\n(Separe cards com linha em branco ou ---)`
        });
        return;
    }

    if (cardsExtraidos.length > 18) {
        await sock.sendMessage(remoteJid, { text: `⚠️ Máximo de 18 cards por vez! Você enviou ${cardsExtraidos.length}.` });
        return;
    }

    let salvos = 0;
    for (const card of cardsExtraidos) {
        try {
            db.prepare(`INSERT INTO cards (dono_jid, nome, descricao, tipo, dano, buff, debuff, raridade)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
              .run(sender, card.nome, card.descricao, card.tipo, card.dano, card.buff, card.debuff, card.raridade);
            salvos++;
        } catch (_) {}
    }

    logDB('cards_salvos', sender, '', `${salvos} cards`);
    const resumo = cardsExtraidos.map(c =>
        `🃏 *${c.nome}* | ${c.tipo} | DMG:${c.dano} | BUFF:${c.buff} | DEBUFF:${c.debuff} | ${c.raridade}`
    ).join('\n');

    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
   🃏 *CARDS SALVOS!* 🃏

${resumo}

✅ *${salvos}* card(s) adicionado(s) à sua coleção!
Use */meuscards* para ver todos.
${BORDA_BOT}`
    });
}

// ─── VER MEUS CARDS ──────────────────────────────────────
export async function commandMeusCards(sock, remoteJid, sender) {
    const cards = db.prepare('SELECT * FROM cards WHERE dono_jid = ? ORDER BY id DESC').all(sender);
    if (!cards.length) {
        await sock.sendMessage(remoteJid, { text: `📭 Você não tem cards!\n\nEnvie seus cards com o formato padrão para que o bot os leia.` }); return;
    }
    const lista = cards.map(c =>
        `🃏 *#${c.id} ${c.nome}*\n   Tipo: ${c.tipo} | DMG: ${c.dano} | BUFF: ${c.buff} | DEBUFF: ${c.debuff}\n   📝 ${c.descricao || 'Sem descrição'}`
    ).join('\n\n');
    await sock.sendMessage(remoteJid, {
        text: `${BORDA_TOPO}\n${TITULO}\n   🃏 *SEUS CARDS (${cards.length})*\n\n${lista}\n${BORDA_BOT}`
    });
}

// ─── DELETAR CARD ────────────────────────────────────────
export async function commandDeletarCard(sock, remoteJid, sender, idStr) {
    const id = parseInt(idStr);
    if (!id) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */deletarcard [id]*` }); return; }
    const card = db.prepare('SELECT * FROM cards WHERE id = ? AND dono_jid = ?').get(id, sender);
    if (!card) { await sock.sendMessage(remoteJid, { text: `❌ Card #${id} não encontrado ou não é seu!` }); return; }
    db.prepare('DELETE FROM cards WHERE id = ?').run(id);
    await sock.sendMessage(remoteJid, { text: `✅ Card *${card.nome}* (#${id}) removido!` });
}

// ─── EXTRAIR CARDS DO TEXTO ───────────────────────────────
function extrairCards(texto) {
    const blocos = texto.split(/---|\n\n+/).filter(b => b.trim().length > 0);
    const cards = [];

    for (const bloco of blocos) {
        const linhas = bloco.split('\n');
        const get = (...termos) => {
            for (const t of termos) {
                const l = linhas.find(l => l.toLowerCase().includes(t.toLowerCase()));
                if (l) return l.split(/[:：]/)[1]?.trim() || '';
            }
            return '';
        };

        const nome = get('nome:', 'card:');
        if (!nome) continue;

        const tipo      = get('tipo:').toLowerCase() || 'ataque';
        const dano      = parseInt(get('dano:', 'dmg:') || '0') || 0;
        const buff      = parseInt(get('buff:', 'cura:') || '0') || 0;
        const debuff    = parseInt(get('debuff:', 'fraqueza:') || '0') || 0;
        const descricao = get('descrição:', 'descricao:', 'desc:') || '';
        const raridade  = _detectarRaridade(nome, dano, buff, debuff);

        cards.push({ nome, tipo, dano, buff, debuff, descricao, raridade });
    }
    return cards;
}

function _detectarRaridade(nome, dano, buff, debuff) {
    const total = dano + buff + debuff;
    if (total >= 80) return '💎 Lendário';
    if (total >= 50) return '🟣 Épico';
    if (total >= 30) return '🔵 Raro';
    if (total >= 15) return '🟢 Incomum';
    return '⚪ Comum';
}
