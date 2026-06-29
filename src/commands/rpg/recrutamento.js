import db from '../../database/connection.js';
import { extrairCampo, proximoIdRpg, logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── DETECTAR FICHA DE RECRUTAMENTO ──────────────────────
export function detectarFicha(texto) {
    const lower = texto.toLowerCase();
    return lower.includes('ficha de recrutamento') || lower.includes('nick escolhido') || lower.includes('nick:');
}

// ─── PROCESSAR FICHA ──────────────────────────────────────
export async function processarFicha(sock, remoteJid, sender, texto) {
    try {
        // Verificar cadastro existente
        const check = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
        if (check) {
            await sock.sendMessage(remoteJid, {
                text: `⚠️ @${sender.split('@')[0]} você já possui um perfil!\n\nID: *${check.id_rpg}* | Nick: *${check.nick}*\nUse */perfil* para ver sua ficha.`,
                mentions: [sender]
            });
            return;
        }

        const lines = texto.split('\n');
        const nick       = extrairCampo(lines, 'Nick Escolhido:', 'Nick:', 'Nome:');
        const familia    = extrairCampo(lines, 'Família:', 'Familia:', 'Clã:', 'Cla:') || 'Nenhuma';
        const nacao      = extrairCampo(lines, 'Nação:', 'Nacao:', 'Vila:', 'Aldeia:') || 'Nenhuma';
        const recrutador = extrairCampo(lines, 'Recrutador:', 'Recruta:', 'Recrutado por:') || 'Sistema';

        if (!nick) {
            await sock.sendMessage(remoteJid, {
                text: `❌ Não consegui ler o *Nick* da ficha!\n\nVerifique se o formato está correto:\n*Nick Escolhido:* SeuNick`
            });
            return;
        }

        // Verificar nick duplicado
        const nickCheck = db.prepare('SELECT nick FROM jogadores WHERE LOWER(nick) = ?').get(nick.toLowerCase());
        if (nickCheck) {
            await sock.sendMessage(remoteJid, { text: `❌ O nick *${nick}* já está em uso! Escolha outro.` });
            return;
        }

        const novoId = proximoIdRpg();

        db.prepare(`
            INSERT INTO jogadores (jid, id_rpg, nick, raca, patente, familia, nacao, vila, recrutador,
                                   hp, max_hp, chakra, max_chakra, xp, nivel, ienes, engrenagens, fichas)
            VALUES (?, ?, ?, 'Indefinida', '⏺️ Cidadão', ?, ?, ?, ?, 100, 100, 100, 100, 0, 1, 0, 0, 0)
        `).run(sender, novoId, nick, familia, nacao, nacao, recrutador);

        logDB('recrutamento', sender, '', `ID:${novoId} Nick:${nick}`);

        await sock.sendMessage(remoteJid, {
            text:
`${BORDA_TOPO}
${TITULO}
    📃 *RECRUTAMENTO APROVADO!* 📃

_￫🆔◈ ID:  ⌊ ${novoId} ⌉_
_￫🧾◈ Nick:  ⌊ ${nick} ⌉_
_￫🧬◈ Raça:  ⌊ ❓ Indefinida ⌉_
_￫⛩️◈ Família:  ⌊ ${familia} ⌉_
_￫🏙️◈ Nação:  ⌊ ${nacao} ⌉_
_￫🔘◈ Patente:  ⌊ ⏺️ Cidadão ⌉_
_￫✒️◈ Recrutador:  ⌊ ${recrutador} ⌉_

${BORDA_BOT}

🍊 Bem-vindo(a) ao RPG, @${sender.split('@')[0]}!
Use */escolher raça Humano* ou */escolher raça Oni*`,
            mentions: [sender]
        });

    } catch (e) {
        console.error('Erro no recrutamento:', e);
        await sock.sendMessage(remoteJid, { text: `❌ Erro interno ao processar ficha. Tente novamente.` });
    }
}
