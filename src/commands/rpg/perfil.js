import db from '../../database/connection.js';

export async function commandPerfil(sock, remoteJid, sender) {
    // Garante que o JID seja buscado perfeitamente no simulador JSON
    const jogador = db.prepare('select * from jogadores where jid = ?').get(sender);

    if (!jogador) {
        await sock.sendMessage(remoteJid, { 
            text: `❌ *Você não possui um registro!* Envie sua *📃 Ficha de Recrutamento* para começar.` 
        });
        return;
    }

    // Design Visual Limpo e Profissional no WhatsApp
    const fichaVisual = 
        `🍊 *STATUS DO GUERREIRO* 🍊\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Nick:* ${jogador.nick}\n` +
        `🆔 *ID RPG:* #${jogador.id_rpg}\n` +
        `🧬 *Raça:* ${jogador.raca === 'Humano' ? '👱🏻‍♂️ Humano' : '👹 Oni'}\n` +
        `🎖️ *Patente:* ${jogador.patente}\n` +
        `🏡 *Vila:* ${jogador.vila}\n` +
        `♌ *Família:* ${jogador.familia}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🩸 *HP:* [ ${jogador.hp} / ${jogador.max_hp} ]\n` +
        `⚡ *Chakra:* [ ${jogador.chakra} / ${jogador.max_chakra} ]\n` +
        `✨ *XP Atual:* ${jogador.xp}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `💰 *FINANÇAS* 💰\n` +
        `💵 *Ienes:* 💰 ${jogador.ienes}\n` +
        `🎐 *Fichas:* 🎐 ${jogador.fichas}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎒 *Inventário:* /inventario\n` +
        `⚔️ *Técnicas:* /tecnicas\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;

    await sock.sendMessage(remoteJid, { text: fichaVisual });
}
