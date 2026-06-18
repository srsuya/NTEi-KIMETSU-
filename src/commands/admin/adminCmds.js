import db from '../../database/connection.js';
import { EconomyService } from '../../services/economy.js';

export async function commandAdminManager(sock, remoteJid, text) {
    const args = text.split(' ');
    const comando = args[0].toLowerCase();

    // /addienes @marcar valor OU /addienes 1001 valor
    if (comando === '/addienes' || comando === '/addfichas') {
        const target = args[1];
        const valor = parseInt(args[2]);
        const moeda = comando === '/addienes' ? 'IENES' : 'FICHAS';

        if (!target || isNaN(valor)) {
            await sock.sendMessage(remoteJid, { text: `❌ Uso: ${comando} [ID_RPG ou @marcar] [valor]` });
            return;
        }

        let queryUser;
        if (target.includes('@')) {
            const jidClean = target.replace('@', '') + '@s.whatsapp.net';
            queryUser = db.prepare('SELECT jid, nick FROM jogadores WHERE jid = ?').get(jidClean);
        } else {
            queryUser = db.prepare('SELECT jid, nick FROM jogadores WHERE id_rpg = ?').get(target);
        }

        if (!queryUser) {
            await sock.sendMessage(remoteJid, { text: '❌ Jogador não localizado no banco de dados.' });
            return;
        }

        const res = EconomyService.alterarSaldo(queryUser.jid, moeda, valor, 'ADD', 'Adicionado pelo Administrador');
        if (res.success) {
            await sock.sendMessage(remoteJid, { text: `✅ Sucesso! Adicionado ${valor} ${moeda === 'IENES' ? '💰' : '🎐'} para *${queryUser.nick}*.` });
        }
    }

    // /setpatente [ID_RPG] [Nome da Patente]
    if (comando === '/setpatente') {
        const idRpg = args[1];
        const novaPatente = args.slice(2).join(' ');

        if (!idRpg || !novaPatente) {
            await sock.sendMessage(remoteJid, { text: '❌ Uso: /setpatente [ID_RPG] [Nome da Patente]' });
            return;
        }

        const alterado = db.prepare('UPDATE jogadores SET patente = ? WHERE id_rpg = ?').run(novaPatente, idRpg);
        if (alterado.changes > 0) {
            await sock.sendMessage(remoteJid, { text: `✅ Patente atualizada com sucesso para o ID #${idRpg}.` });
        } else {
            await sock.sendMessage(remoteJid, { text: '❌ ID não encontrado.' });
        }
    }
}
