import db from '../../database/connection.js';
import { getMentioned, fmtNum, logDB, proximoIdRpg, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── ADD IENES ────────────────────────────────────────────
export async function cmdAddIenes(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'ienes', '+');
    if (res) logDB('add_ienes', msg.key.participant || msg.key.remoteJid, res.jid, `+${res.valor}`);
}

export async function cmdRmIenes(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'ienes', '-');
    if (res) logDB('rm_ienes', msg.key.participant || msg.key.remoteJid, res.jid, `-${res.valor}`);
}

export async function cmdAddEng(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'engrenagens', '+');
    if (res) logDB('add_eng', msg.key.participant || msg.key.remoteJid, res.jid, `+${res.valor}`);
}

export async function cmdRmEng(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'engrenagens', '-');
    if (res) logDB('rm_eng', msg.key.participant || msg.key.remoteJid, res.jid, `-${res.valor}`);
}

export async function cmdAddFichas(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'fichas', '+');
    if (res) logDB('add_fichas', msg.key.participant || msg.key.remoteJid, res.jid, `+${res.valor}`);
}

export async function cmdRmFichas(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'fichas', '-');
    if (res) logDB('rm_fichas', msg.key.participant || msg.key.remoteJid, res.jid, `-${res.valor}`);
}

export async function cmdAddXp(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'xp', '+');
    if (res) {
        // Verificar level up
        const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(res.jid);
        const xpNecessario = j.nivel * 500;
        if (j.xp >= xpNecessario) {
            const novoNivel = j.nivel + 1;
            db.prepare(`UPDATE jogadores SET nivel = ?, xp = xp - ?, max_hp = max_hp + 10, max_chakra = max_chakra + 10 WHERE jid = ?`)
              .run(novoNivel, xpNecessario, res.jid);
            await sock.sendMessage(remoteJid, {
                text: `🎉 *${j.nick}* subiu para o nível *${novoNivel}*! (+10 HP max, +10 Chakra max)`
            });
        }
        logDB('add_xp', msg.key.participant || msg.key.remoteJid, res.jid, `+${res.valor}`);
    }
}

export async function cmdRmXp(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const res = await _modEco(sock, remoteJid, msg, args, 'xp', '-');
    if (res) logDB('rm_xp', msg.key.participant || msg.key.remoteJid, res.jid, `-${res.valor}`);
}

// ─── HELPER INTERNO ECONOMIA ──────────────────────────────
async function _modEco(sock, remoteJid, msg, args, campo, op) {
    const mencionados = getMentioned(msg);

    // Suporta @mencao ou id:XXXX
    let alvo = null;
    let jidAlvo = null;

    if (mencionados.length) {
        jidAlvo = mencionados[0];
        alvo = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(jidAlvo);
    } else {
        const idMatch = args.match(/id:(\d+)/i);
        if (idMatch) {
            alvo = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(parseInt(idMatch[1]));
            jidAlvo = alvo?.jid;
        }
    }

    if (!alvo) { await sock.sendMessage(remoteJid, { text: `❌ Jogador não encontrado! Use @menção ou id:XXXX` }); return null; }

    const valorMatch = args.match(/(\d+)/g);
    const valores = valorMatch ? valorMatch.filter(v => !args.includes(`id:${v}`)) : [];
    const valor = parseInt(valores[0]);

    if (!valor || valor <= 0) { await sock.sendMessage(remoteJid, { text: `❌ Informe o valor! Ex: /addienes @user 500` }); return null; }

    const novoValor = op === '+' ? alvo[campo] + valor : Math.max(0, alvo[campo] - valor);
    db.prepare(`UPDATE jogadores SET ${campo} = ? WHERE jid = ?`).run(novoValor, jidAlvo);

    const emoji = { ienes: '💰', engrenagens: '⚙️', fichas: '🃏', xp: '✨' }[campo] || '📊';
    await sock.sendMessage(remoteJid, {
        text: `✅ ${emoji} *${campo.charAt(0).toUpperCase() + campo.slice(1)}* de *${alvo.nick}* ${op === '+' ? 'adicionado' : 'removido'}!\n\nAntes: ${fmtNum(alvo[campo])}\nDepois: ${fmtNum(novoValor)}`,
        mentions: [jidAlvo]
    });
    return { jid: jidAlvo, valor };
}

// ─── SET PATENTE ──────────────────────────────────────────
// Suporta @user ou id:XXXX
export async function cmdSetPatente(sock, remoteJid, msg, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }

    const mencionados = getMentioned(msg);
    let alvo = null;

    if (mencionados.length) {
        alvo = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(mencionados[0]);
    } else {
        const idMatch = args.match(/id:(\d+)/i);
        if (idMatch) alvo = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(parseInt(idMatch[1]));
    }

    if (!alvo) { await sock.sendMessage(remoteJid, { text: `❌ Jogador não encontrado!` }); return; }

    const patente = args.replace(/id:\d+|@\S+/g, '').replace(/\d+/g, '').trim();
    if (!patente) { await sock.sendMessage(remoteJid, { text: `❌ Informe a patente! Ex: /setpatente @user Hashira` }); return; }

    db.prepare(`UPDATE jogadores SET patente = ? WHERE jid = ?`).run(patente, alvo.jid);
    logDB('set_patente', msg.key.participant || msg.key.remoteJid, alvo.jid, patente);
    await sock.sendMessage(remoteJid, {
        text: `✅ Patente de *${alvo.nick}* definida como *${patente}*!`,
        mentions: [alvo.jid]
    });
}

// ─── RESET USUÁRIO ────────────────────────────────────────
export async function cmdResetUsuario(sock, remoteJid, msg, nivel) {
    if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Restrito ao dono.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    const j = db.prepare('SELECT nick FROM jogadores WHERE jid = ?').get(mencionados[0]);
    db.prepare('DELETE FROM jogadores WHERE jid = ?').run(mencionados[0]);
    logDB('reset_usuario', msg.key.participant || msg.key.remoteJid, mencionados[0], 'Perfil deletado');
    await sock.sendMessage(remoteJid, {
        text: `✅ Perfil de *${j?.nick || mencionados[0].split('@')[0]}* removido com sucesso.`,
        mentions: mencionados
    });
}

// ─── RESET RAÇA ───────────────────────────────────────────
export async function cmdResetRaca(sock, remoteJid, msg, nivel) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    db.prepare(`UPDATE jogadores SET raca = 'Indefinida' WHERE jid = ?`).run(mencionados[0]);
    await sock.sendMessage(remoteJid, {
        text: `✅ Raça de @${mencionados[0].split('@')[0]} redefinida para *Indefinida*.`,
        mentions: mencionados
    });
}

// ─── ADD ADMIN BOT ────────────────────────────────────────
export async function cmdAddAdminBot(sock, remoteJid, msg, nivel) {
    if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Restrito ao dono.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    db.prepare(`INSERT OR REPLACE INTO admins (jid, nivel) VALUES (?, 'admin')`).run(mencionados[0]);
    await sock.sendMessage(remoteJid, {
        text: `✅ @${mencionados[0].split('@')[0]} promovido a *Admin do Bot*!`,
        mentions: mencionados
    });
}

// ─── REMOVE ADMIN BOT ─────────────────────────────────────
export async function cmdRemoveAdminBot(sock, remoteJid, msg, nivel) {
    if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Restrito ao dono.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    db.prepare(`DELETE FROM admins WHERE jid = ?`).run(mencionados[0]);
    await sock.sendMessage(remoteJid, {
        text: `✅ @${mencionados[0].split('@')[0]} removido dos admins do bot.`,
        mentions: mencionados
    });
}

// ─── LISTA ADMINS ─────────────────────────────────────────
export async function cmdListaAdmins(sock, remoteJid, nivel) {
    if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Restrito ao dono.` }); return; }
    const admins = db.prepare('SELECT * FROM admins ORDER BY nivel').all();
    if (!admins.length) { await sock.sendMessage(remoteJid, { text: `📭 Nenhum admin cadastrado.` }); return; }
    const lista = admins.map(a => `🛡️ +${a.jid.split('@')[0]} — ${a.nivel}`).join('\n');
    await sock.sendMessage(remoteJid, { text: `${BORDA_TOPO}\n🛡️ *ADMINS DO BOT*\n\n${lista}\n${BORDA_BOT}` });
}

// ─── LISTA ID ─────────────────────────────────────────────
export async function cmdListaId(sock, remoteJid, nivel) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const jogadores = db.prepare('SELECT id_rpg, nick, patente FROM jogadores ORDER BY id_rpg').all();
    if (!jogadores.length) { await sock.sendMessage(remoteJid, { text: `📭 Nenhum jogador cadastrado.` }); return; }
    const lista = jogadores.map(j => `*${j.id_rpg}* | ${j.nick} | ${j.patente}`).join('\n');
    await sock.sendMessage(remoteJid, {
        text: `${BORDA_TOPO}\n${TITULO}\n  📋 *LISTA DE IDs*\n\n${lista}\n${BORDA_BOT}`
    });
}

// ─── LISTA JOGADORES ──────────────────────────────────────
export async function cmdListaJogadores(sock, remoteJid) {
    const jogadores = db.prepare('SELECT id_rpg, nick, raca, familia, patente FROM jogadores ORDER BY id_rpg').all();
    if (!jogadores.length) { await sock.sendMessage(remoteJid, { text: `📭 Nenhum jogador.` }); return; }
    const lista = jogadores.map(j =>
        `*${j.id_rpg}* | ${j.nick} | ${j.raca} | ${j.familia} | ${j.patente}`
    ).join('\n');
    await sock.sendMessage(remoteJid, {
        text: `${BORDA_TOPO}\n${TITULO}\n  👥 *JOGADORES CADASTRADOS*\n\n${lista}\n\nTotal: *${jogadores.length}*\n${BORDA_BOT}`
    });
}

// ─── CONSULTA ID ──────────────────────────────────────────
export async function cmdConsultaId(sock, remoteJid, idStr) {
    const id = parseInt(idStr);
    if (!id) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */consultaid 1001*` }); return; }
    const j = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(id);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Nenhum jogador com ID *${id}*!` }); return; }

    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
   🔍 *CONSULTA — ID ${j.id_rpg}* 🔍

🆔 ID: *${j.id_rpg}*
👤 Nick: *${j.nick}*
🧬 Raça: *${j.raca}*
⛩️ Família: *${j.familia}*
🏙️ Nação: *${j.nacao}*
🔘 Patente: *${j.patente}*
⭐ Nível: *${j.nivel}* | XP: *${fmtNum(j.xp)}*
❤️ HP: *${j.hp}/${j.max_hp}*
💰 Ienes: *${fmtNum(j.ienes)}*
⚙️ Engrenagens: *${fmtNum(j.engrenagens)}*
🃏 Fichas: *${fmtNum(j.fichas)}*
✒️ Recrutador: *${j.recrutador}*
📅 Desde: *${j.criado_em}*
${BORDA_BOT}`
    });
}

// ─── GRUPO: BANIR / PROMOVER / REBAIXAR ──────────────────
export async function cmdBanir(sock, remoteJid, msg, nivel) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    try {
        await sock.groupParticipantsUpdate(remoteJid, mencionados, 'remove');
        await sock.sendMessage(remoteJid, {
            text: `✅ @${mencionados[0].split('@')[0]} foi removido do grupo.`,
            mentions: mencionados
        });
    } catch (e) {
        await sock.sendMessage(remoteJid, { text: `❌ Não foi possível remover. Sou admin do grupo?` });
    }
}

export async function cmdPromoverGrupo(sock, remoteJid, msg, nivel) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    try {
        await sock.groupParticipantsUpdate(remoteJid, mencionados, 'promote');
        await sock.sendMessage(remoteJid, {
            text: `✅ @${mencionados[0].split('@')[0]} promovido a admin do grupo!`,
            mentions: mencionados
        });
    } catch (e) {
        await sock.sendMessage(remoteJid, { text: `❌ Falha ao promover.` });
    }
}

export async function cmdRebaixarGrupo(sock, remoteJid, msg, nivel) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const mencionados = getMentioned(msg);
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    try {
        await sock.groupParticipantsUpdate(remoteJid, mencionados, 'demote');
        await sock.sendMessage(remoteJid, {
            text: `✅ @${mencionados[0].split('@')[0]} rebaixado no grupo.`,
            mentions: mencionados
        });
    } catch (e) {
        await sock.sendMessage(remoteJid, { text: `❌ Falha ao rebaixar.` });
    }
}

// ─── STATS ───────────────────────────────────────────────
export async function cmdStats(sock, remoteJid, nivel) {
    if (nivel !== 'ntei') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const totalJ  = db.prepare('SELECT COUNT(*) as c FROM jogadores').get();
    const totalA  = db.prepare('SELECT COUNT(*) as c FROM admins').get();
    const totalL  = db.prepare('SELECT COUNT(*) as c FROM lutas').get();
    const totalT  = db.prepare('SELECT COUNT(*) as c FROM transferencias WHERE cancelada = 0').get();
    const topIen  = db.prepare('SELECT nick, ienes FROM jogadores ORDER BY ienes DESC LIMIT 3').all();
    const topXp   = db.prepare('SELECT nick, xp, nivel FROM jogadores ORDER BY xp DESC LIMIT 3').all();

    let rankIen = topIen.map((j, i) => `${i + 1}. *${j.nick}* — ${fmtNum(j.ienes)} ienes`).join('\n');
    let rankXp  = topXp.map((j, i) => `${i + 1}. *${j.nick}* — Nv.${j.nivel} (${fmtNum(j.xp)} XP)`).join('\n');

    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
   📊 *ESTATÍSTICAS DO SISTEMA* 📊

👤 Jogadores: *${totalJ.c}*
🛡️ Admins Bot: *${totalA.c}*
⚔️ Lutas registradas: *${totalL.c}*
💸 Transferências: *${totalT.c}*

💰 *Top 3 Ienes:*
${rankIen}

✨ *Top 3 XP:*
${rankXp}
${BORDA_BOT}`
    });
}

// ─── TABELA IENES (leitura automática) ───────────────────
// Formato: /addtabela id:1001 2500
export async function cmdAddTabela(sock, remoteJid, nivel, args) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const match = args.match(/id:(\d+)\s+(\d+)/i);
    if (!match) { await sock.sendMessage(remoteJid, { text: `❌ Formato: */addtabela id:1001 2500*` }); return; }
    const [, idStr, valorStr] = match;
    const j = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(parseInt(idStr));
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ ID *${idStr}* não encontrado!` }); return; }
    const valor = parseInt(valorStr);
    db.prepare(`UPDATE jogadores SET ienes = ienes + ? WHERE id_rpg = ?`).run(valor, parseInt(idStr));
    await sock.sendMessage(remoteJid, {
        text: `✅ *+${fmtNum(valor)} ienes* adicionados a *${j.nick}* (ID: ${j.id_rpg})\nNovo saldo: *${fmtNum(j.ienes + valor)} ienes*`
    });
}
