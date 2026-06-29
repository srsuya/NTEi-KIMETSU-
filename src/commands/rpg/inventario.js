import db from '../../database/connection.js';
import { logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

export async function commandInventario(sock, remoteJid, sender) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) {
        await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil cadastrado!` });
        return;
    }
    const inv = j.inventario?.trim() || '_vazio_';
    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
      🎒 *INVENTÁRIO DE ${j.nick}* 🎒

${inv}
${BORDA_BOT}`
    });
}

export async function commandSalvarInventario(sock, remoteJid, sender, texto) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) {
        await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil cadastrado!` });
        return;
    }
    if (!texto) {
        await sock.sendMessage(remoteJid, { text: `❌ Use: */salvarinventario [conteúdo]*` });
        return;
    }
    db.prepare(`UPDATE jogadores SET inventario = ?, atualizado_em = datetime('now','localtime') WHERE jid = ?`)
      .run(texto, sender);
    logDB('inventario', sender, sender, `Salvo: ${texto.substring(0, 50)}`);
    await sock.sendMessage(remoteJid, { text: `✅ Inventário de *${j.nick}* atualizado com sucesso!` });
}
