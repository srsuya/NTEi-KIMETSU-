// src/commands/rpg/tecnicas.js
import db from '../../database/connection.js';

export async function commandTecnicas(sock, remoteJid, sender) {
    const jogador = db.prepare('SELECT nick, raca, patente FROM jogadores WHERE jid = ?').get(sender);
    if (!jogador) {
        await sock.sendMessage(remoteJid, { text: '❌ Você não possui um registro!' });
        return;
    }

    let msgTecnicas = `⚔️ *ÁRVORE DE TÉCNICAS* ⚔️\n`;
    msgTecnicas += `👤 *Guerreiro:* ${jogador.nick}\n`;
    msgTecnicas += `🧬 *Estilo atual:* ${jogador.raca === 'Humano' ? '🌬️ Respiração' : '🩸 Ketsuryutsu (Arte de Sangue)'}\n`;
    msgTecnicas += `━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Exemplo de lógica baseada na raça
    if (jogador.raca === 'Humano') {
        msgTecnicas += `🌅 *Técnicas Disponíveis (Humano - ${jogador.patente}):*\n`;
        msgTecnicas += `▫️ *Estocada Rápida* - [Ativa]\n`;
        msgTecnicas += `▫️ *Concentração Total* - [Foco]\n`;
    } else if (jogador.raca === 'Oni') {
        msgTecnicas += `👹 *Técnicas Disponíveis (Oni - ${jogador.patente}):*\n`;
        msgTecnicas += `▫️ *Regeneração Celular* - [Passiva]\n`;
        msgTecnicas += `▫️ *Garras de Sangue* - [Ativa]\n`;
    } else {
        msgTecnicas += `❌ Defina sua raça para liberar técnicas!\n`;
    }

    msgTecnicas += `━━━━━━━━━━━━━━━━━━━━━━\n`;
    msgTecnicas += `💡 *Treine ou suba de patente para liberar novas habilidades.*`;

    await sock.sendMessage(remoteJid, { text: msgTecnicas });
}
