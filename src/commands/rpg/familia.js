import db from '../../database/connection.js';
import { logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

export async function commandFamilias(sock, remoteJid) {
    // Puxa todas as famílias ativas do banco de dados
    const fams = db.prepare('SELECT * FROM familias WHERE ativo = 1 ORDER BY vila, nome').all();
    
    if (fams.length === 0) {
        await sock.sendMessage(remoteJid, { text: `⚠️ Nenhuma família disponível no momento.` });
        return;
    }

    // Monta o menu dinamicamente usando os dados do Banco, mas com o visual bonito do segundo código
    let listaTexto = `*➖᭄⎝ᯌ •➖• ஜ •⸨⛩️⸩• ஜ •➖• ᯌ⎞➖᭄*\n`;
    listaTexto += `      _ᗂ ⛩️ Famílias Disponíveis ⛩️ ᗃ_\n\n`;

    let vilaAtual = '';
    fams.forEach(f => {
        // Se mudou de vila, adiciona o cabeçalho da vila
        if (f.vila !== vilaAtual) {
            vilaAtual = f.vila;
            listaTexto += `ᗂ🌅• ${vilaAtual} •🌅ᗃ\n`;
        }
        // Adiciona a família, seu emoji e descrição vindos do banco de dados
        listaTexto += `> Família ${f.nome}   ⃝${f.emoji || '⚔️'}\n`;
        listaTexto += `- ${f.descricao}\n\n`;
    });

    listaTexto += `💬 Use: */escolherfamilia [nome]*\n`;
    listaTexto += `*➖᭄⎝ᯌ •➖• ஜ •⸨⛩️⸩• ஜ •➖• ᯌ⎞➖᭄*`;

    await sock.sendMessage(remoteJid, { text: listaTexto });
}

export async function commandEscolherFamilia(sock, remoteJid, sender, nomeFam) {
    if (!nomeFam) {
        await sock.sendMessage(remoteJid, { text: `❌ Digite o nome da família. Exemplo: */escolherfamilia Kamado*` });
        return;
    }

    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil!` }); return; }
    
    if (j.familia && j.familia !== 'Nenhuma') {
        await sock.sendMessage(remoteJid, { text: `❌ Você já pertence à família *${j.familia}*!` }); return;
    }

    // Busca no banco ignorando maiúsculas/minúsculas
    const fam = db.prepare('SELECT * FROM familias WHERE LOWER(nome) = ? AND ativo = 1').get(nomeFam.toLowerCase().trim());
    if (!fam) { await sock.sendMessage(remoteJid, { text: `❌ Família *${nomeFam}* não encontrada! Use */familias* para ver a lista.` }); return; }

    // Salva a escolha no banco de dados
    db.prepare(`UPDATE jogadores SET familia = ?, atualizado_em = datetime('now','localtime') WHERE jid = ?`).run(fam.nome, sender);
    db.prepare(`UPDATE familias SET membros = membros + 1 WHERE id = ?`).run(fam.id);
    
    logDB('familia', sender, fam.nome, `Escolheu família ${fam.nome}`);

    await sock.sendMessage(remoteJid, {
        text: `✅ @${sender.split('@')[0]} agora faz parte da família *${fam.nome}* ${fam.emoji}!\n\nUse */perfil* para ver sua ficha atualizada.`,
        mentions: [sender]
    });
}
