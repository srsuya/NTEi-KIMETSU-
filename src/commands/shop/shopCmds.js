import db from '../../database/connection.js';
import { logDB, fmtNum, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── EXIBIR LOJA ─────────────────────────────────────────
export async function commandLoja(sock, remoteJid, tipo = 'IENES') {
    const loja = db.prepare('SELECT * FROM lojas WHERE tipo = ?').get(tipo);
    if (loja) {
        await sock.sendMessage(remoteJid, { text: loja.conteudo });
        return;
    }
    // Gerar loja padrão dinâmica
    const itens = db.prepare('SELECT * FROM itens_loja WHERE UPPER(moeda) = ? AND ativo = 1').all(tipo);
    if (!itens.length) {
        await sock.sendMessage(remoteJid, { text: `🏪 A loja de *${tipo}* ainda não tem itens! Um admin deve criá-la com */criarloja*.` });
        return;
    }
    let lista = itens.map(i => `🛒 *${i.nome}* — ${fmtNum(i.preco)} ${tipo.toLowerCase()}\n   📝 ${i.descricao}`).join('\n\n');
    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
   🏪 *LOJA DE ${tipo}* 🏪

${lista}

💬 Use: */comprar [nome do item]*
${BORDA_BOT}`
    });
}

// ─── CRIAR LOJA (admin envia modelo completo) ─────────────
export async function commandCriarLoja(sock, remoteJid, nivel, texto) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }

    // Detectar tipo da loja no texto
    const tipoMatch = texto.match(/loja\s+de\s+(ienes|fichas|engrenagens)/i);
    const tipo = tipoMatch ? tipoMatch[1].toUpperCase() : 'IENES';

    db.prepare(`INSERT INTO lojas (tipo, conteudo) VALUES (?, ?)
                ON CONFLICT(tipo) DO UPDATE SET conteudo = ?, atualizado_em = datetime('now','localtime')`)
      .run(tipo, texto, texto);

    await sock.sendMessage(remoteJid, { text: `✅ Loja de *${tipo}* atualizada com sucesso!\n\nUse */loja* para visualizar.` });
}

// ─── COMPRAR ─────────────────────────────────────────────
export async function commandComprar(sock, remoteJid, sender, nomeItem) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Sem perfil cadastrado!` }); return; }
    if (!nomeItem) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */comprar [nome do item]*` }); return; }

    const item = db.prepare(`SELECT * FROM itens_loja WHERE LOWER(nome) LIKE ? AND ativo = 1`)
                   .get(`%${nomeItem.toLowerCase()}%`);
    if (!item) { await sock.sendMessage(remoteJid, { text: `❌ Item *${nomeItem}* não encontrado na loja!` }); return; }

    const campo = item.moeda === 'fichas' ? 'fichas' : item.moeda === 'engrenagens' ? 'engrenagens' : 'ienes';
    if (j[campo] < item.preco) {
        await sock.sendMessage(remoteJid, {
            text: `❌ Saldo insuficiente!\nPreço: *${fmtNum(item.preco)} ${item.moeda}*\nSeu saldo: *${fmtNum(j[campo])} ${item.moeda}*`
        }); return;
    }
    if (item.estoque === 0) { await sock.sendMessage(remoteJid, { text: `❌ Item *${item.nome}* sem estoque!` }); return; }

    db.transaction(() => {
        db.prepare(`UPDATE jogadores SET ${campo} = ${campo} - ? WHERE jid = ?`).run(item.preco, sender);
        if (item.estoque > 0) db.prepare(`UPDATE itens_loja SET estoque = estoque - 1 WHERE id = ?`).run(item.id);
        // Adicionar ao inventário
        const invAtual = j.inventario ? j.inventario + '\n' : '';
        db.prepare(`UPDATE jogadores SET inventario = ? WHERE jid = ?`).run(`${invAtual}🛍️ ${item.nome}`, sender);
    })();

    logDB('compra', sender, item.nome, `Valor: ${item.preco} ${item.moeda}`);
    await sock.sendMessage(remoteJid, {
        text: `✅ @${sender.split('@')[0]} comprou *${item.nome}* por *${fmtNum(item.preco)} ${item.moeda}*!\n\nItem adicionado ao inventário. Use */inventario* para ver.`,
        mentions: [sender]
    });
}

// ─── ADD ITEM NA LOJA (admin) ─────────────────────────────
// /additem [nome] | [preço] | [moeda] | [descrição]
export async function commandAddItem(sock, remoteJid, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const partes = args.split('|').map(p => p.trim());
    if (partes.length < 3) {
        await sock.sendMessage(remoteJid, { text: `❌ Formato: */additem Nome | Preço | Moeda | Descrição*` }); return;
    }
    const [nome, precoStr, moeda, descricao = ''] = partes;
    const preco = parseInt(precoStr);
    if (!preco) { await sock.sendMessage(remoteJid, { text: `❌ Preço inválido!` }); return; }
    db.prepare(`INSERT INTO itens_loja (nome, preco, moeda, descricao) VALUES (?, ?, ?, ?)`)
      .run(nome, preco, moeda.toLowerCase(), descricao);
    await sock.sendMessage(remoteJid, {
        text: `✅ Item *${nome}* adicionado à loja por *${fmtNum(preco)} ${moeda}*!`
    });
}
