import db from '../../database/connection.js';
import { logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ─── NÍVEIS DA IA ────────────────────────────────────────
const NIVEIS = {
    facil:      { nome: 'Fácil',      acerto: 0.60, critico: 0.05, esquiva: 0.10 },
    medio:      { nome: 'Médio',      acerto: 0.75, critico: 0.10, esquiva: 0.15 },
    dificil:    { nome: 'Difícil',    acerto: 0.88, critico: 0.18, esquiva: 0.20 },
    impossivel: { nome: 'Impossível', acerto: 0.97, critico: 0.30, esquiva: 0.35 },
};

// ─── BATALHAS ATIVAS (em memória, persistidas no DB) ─────
const batalhasAtivas = new Map(); // jid -> { estado }

// ─── INICIAR VT (batalha contra a IA) ───────────────────
export async function commandVT(sock, remoteJid, sender, nivelStr = 'medio') {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil!` }); return; }

    if (batalhasAtivas.has(sender)) {
        await sock.sendMessage(remoteJid, { text: `⚠️ Você já tem uma batalha ativa!\nUse */atacar*, */defender*, */fugir* ou */usarcard [nome]*` });
        return;
    }

    const nivelKey = nivelStr.toLowerCase().replace('í', 'i').replace('á', 'a').replace('é', 'e');
    const nivel = NIVEIS[nivelKey] || NIVEIS.medio;

    const iaHp    = 100 + ({ facil: 0, medio: 20, dificil: 50, impossivel: 100 }[nivelKey] || 20);
    const iaChakra = 100;

    const estado = {
        jid: sender,
        nick: j.nick,
        hp: j.hp,
        maxHp: j.max_hp,
        chakra: j.chakra,
        maxChakra: j.max_chakra,
        iaHp, iaMaxHp: iaHp, iaChakra: iaChakra,
        nivel, nivelKey,
        turno: 1,
        log: [],
        cards: _carregarCards(sender),
    };

    batalhasAtivas.set(sender, estado);
    logDB('vt_inicio', sender, `IA_${nivelKey}`, `HP jogador: ${j.hp}`);

    await sock.sendMessage(remoteJid, {
        text:
`${BORDA_TOPO}
${TITULO}
   🤖 *BATALHA VT INICIADA!* 🤖

👤 *${j.nick}* vs 🤖 *IA NTEI (${nivel.nome})*

❤️ Seu HP: ${estado.hp}/${estado.maxHp}
💙 Seu Chakra: ${estado.chakra}/${estado.maxChakra}
🔴 IA HP: ${iaHp}/${iaHp}

⚔️ *Ações disponíveis:*
➡️ */atacar* — Ataque básico
➡️ */defender* — Defende e recupera chakra
➡️ */usarcard [nome]* — Usa um card
➡️ */fugir* — Abandona a batalha

Turno 1 — Sua vez! ⚡
${BORDA_BOT}`
    });
}

// ─── INICIAR SC (modo treino) ─────────────────────────────
export async function commandSC(sock, remoteJid, sender) {
    await commandVT(sock, remoteJid, sender, 'facil');
}

// ─── AÇÃO: ATACAR ────────────────────────────────────────
export async function commandAtacar(sock, remoteJid, sender) {
    const estado = batalhasAtivas.get(sender);
    if (!estado) { await sock.sendMessage(remoteJid, { text: `❌ Você não está em uma batalha! Use */vt* para iniciar.` }); return; }

    const n = estado.nivel;
    const acertou = Math.random() < n.acerto;
    const critico = acertou && Math.random() < n.critico;
    let danoPJ = acertou ? (critico ? 25 : 15) + Math.floor(Math.random() * 10) : 0;

    // Resposta da IA
    const iaAcertou = Math.random() < n.acerto;
    const iaEsquivou = Math.random() < n.esquiva;
    let danoIA = 0;
    if (iaAcertou && !iaEsquivou) {
        danoIA = (n.acerto > 0.9 ? 20 : 10) + Math.floor(Math.random() * 15);
    }

    // Aplicar no modo impossível: IA tenta counter
    if (estado.nivelKey === 'impossivel' && acertou) {
        const counter = Math.random() < 0.4;
        if (counter) danoIA += 10;
    }

    estado.hp       = Math.max(0, estado.hp - danoIA);
    estado.iaHp     = Math.max(0, estado.iaHp - danoPJ);
    estado.turno++;

    const resultado = _verificarFimBatalha(estado, sender, sock, remoteJid);
    if (resultado) return;

    let texto = `${BORDA_TOPO}\n${TITULO}\n   ⚔️ Turno ${estado.turno} ⚔️\n\n`;
    texto += acertou ? `✅ Você ${critico ? '💥 ACERTOU CRÍTICO' : 'acertou'}! *-${danoPJ} HP* na IA\n` : `❌ Você *errou* o ataque!\n`;
    texto += danoIA > 0 ? `🤖 IA contra-atacou! *-${danoIA} HP* em você\n` : `🤖 IA não causou dano\n`;
    texto += `\n❤️ Seu HP: ${estado.hp}/${estado.maxHp}\n🔴 IA HP: ${estado.iaHp}/${estado.iaMaxHp}\n\n➡️ */atacar | /defender | /usarcard | /fugir*\n${BORDA_BOT}`;

    await sock.sendMessage(remoteJid, { text: texto });
    _salvarEstrategia(sender, 'atacar', danoPJ > 0 ? 'acerto' : 'erro');
}

// ─── AÇÃO: DEFENDER ──────────────────────────────────────
export async function commandDefender(sock, remoteJid, sender) {
    const estado = batalhasAtivas.get(sender);
    if (!estado) { await sock.sendMessage(remoteJid, { text: `❌ Você não está em uma batalha!` }); return; }

    // Defesa reduz dano da IA pela metade
    const n = estado.nivel;
    const iaAcertou = Math.random() < n.acerto * 0.6; // esquiva ao defender
    const danoIA = iaAcertou ? Math.floor(((n.acerto > 0.9 ? 20 : 10) + Math.floor(Math.random() * 10)) / 2) : 0;
    const chakraRecup = 20;

    estado.hp       = Math.max(0, estado.hp - danoIA);
    estado.chakra   = Math.min(estado.maxChakra, estado.chakra + chakraRecup);
    estado.turno++;

    const resultado = _verificarFimBatalha(estado, sender, sock, remoteJid);
    if (resultado) return;

    let texto = `${BORDA_TOPO}\n${TITULO}\n   🛡️ Turno ${estado.turno} — DEFESA\n\n`;
    texto += `🛡️ Você se defendeu! +${chakraRecup} chakra recuperado\n`;
    texto += danoIA > 0 ? `🤖 IA causou *${danoIA} HP* (dano reduzido)\n` : `🤖 IA não conseguiu romper sua defesa!\n`;
    texto += `\n❤️ Seu HP: ${estado.hp}/${estado.maxHp}\n💙 Chakra: ${estado.chakra}/${estado.maxChakra}\n🔴 IA HP: ${estado.iaHp}/${estado.iaMaxHp}\n\n➡️ */atacar | /defender | /usarcard | /fugir*\n${BORDA_BOT}`;

    await sock.sendMessage(remoteJid, { text: texto });
    _salvarEstrategia(sender, 'defender', 'defesa');
}

// ─── AÇÃO: USAR CARD ─────────────────────────────────────
export async function commandUsarCard(sock, remoteJid, sender, nomeCard) {
    const estado = batalhasAtivas.get(sender);
    if (!estado) { await sock.sendMessage(remoteJid, { text: `❌ Você não está em uma batalha!` }); return; }
    if (!nomeCard) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */usarcard [nome do card]*` }); return; }

    const card = estado.cards.find(c => c.nome.toLowerCase().includes(nomeCard.toLowerCase()));
    if (!card) {
        await sock.sendMessage(remoteJid, { text: `❌ Card *${nomeCard}* não encontrado!\nUse */meuscards* para ver sua coleção.` }); return;
    }

    const custoCk = 20;
    if (estado.chakra < custoCk) {
        await sock.sendMessage(remoteJid, { text: `❌ Chakra insuficiente! Necessário: ${custoCk}, Atual: ${estado.chakra}` }); return;
    }

    estado.chakra   -= custoCk;
    estado.iaHp     = Math.max(0, estado.iaHp - card.dano);
    if (card.buff)   estado.hp = Math.min(estado.maxHp, estado.hp + card.buff);
    if (card.debuff) estado.iaHp = Math.max(0, estado.iaHp - card.debuff);
    estado.turno++;

    const resultado = _verificarFimBatalha(estado, sender, sock, remoteJid);
    if (resultado) return;

    // IA responde
    const n = estado.nivel;
    const iaAcertou = Math.random() < n.acerto;
    const danoIA = iaAcertou ? (n.acerto > 0.9 ? 22 : 12) + Math.floor(Math.random() * 10) : 0;
    if (danoIA) estado.hp = Math.max(0, estado.hp - danoIA);

    let texto = `${BORDA_TOPO}\n${TITULO}\n   🃏 Turno ${estado.turno} — CARD USADO\n\n`;
    texto += `🃏 *${card.nome}* ativado!\n`;
    if (card.dano)   texto += `⚔️ Dano: *-${card.dano} HP* na IA\n`;
    if (card.buff)   texto += `💚 Cura: *+${card.buff} HP*\n`;
    if (card.debuff) texto += `⬇️ Debuff: *-${card.debuff} HP* na IA\n`;
    texto += `💙 -${custoCk} chakra\n`;
    if (danoIA > 0) texto += `🤖 IA atacou: *-${danoIA} HP*\n`;
    texto += `\n❤️ Seu HP: ${estado.hp}/${estado.maxHp}\n🔴 IA HP: ${estado.iaHp}/${estado.iaMaxHp}\n\n➡️ */atacar | /defender | /usarcard | /fugir*\n${BORDA_BOT}`;

    await sock.sendMessage(remoteJid, { text: texto });
    _salvarEstrategia(sender, `card:${card.nome}`, 'usou_card');
}

// ─── AÇÃO: FUGIR ─────────────────────────────────────────
export async function commandFugir(sock, remoteJid, sender) {
    const estado = batalhasAtivas.get(sender);
    if (!estado) { await sock.sendMessage(remoteJid, { text: `❌ Você não está em uma batalha!` }); return; }
    batalhasAtivas.delete(sender);
    logDB('vt_fuga', sender, '', `Fugiu no turno ${estado.turno}`);
    await sock.sendMessage(remoteJid, {
        text: `🏃 *${estado.nick}* fugiu da batalha no turno ${estado.turno}!\n\n(Nenhuma recompensa concedida)`
    });
}

// ─── VERIFICAR FIM DE BATALHA ────────────────────────────
async function _verificarFimBatalha(estado, sender, sock, remoteJid) {
    if (estado.hp <= 0) {
        batalhasAtivas.delete(sender);
        logDB('vt_derrota', sender, `IA_${estado.nivelKey}`, `Turno ${estado.turno}`);
        await sock.sendMessage(remoteJid, {
            text: `💀 *${estado.nick}* foi derrotado pela IA no turno *${estado.turno}*!\n\nTente novamente com */vt [nível]*`
        });
        return true;
    }
    if (estado.iaHp <= 0) {
        batalhasAtivas.delete(sender);
        // Recompensa XP
        const xpGanho = { facil: 50, medio: 100, dificil: 200, impossivel: 500 }[estado.nivelKey] || 100;
        db.prepare(`UPDATE jogadores SET xp = xp + ? WHERE jid = ?`).run(xpGanho, sender);
        logDB('vt_vitoria', sender, `IA_${estado.nivelKey}`, `Turno ${estado.turno} XP+${xpGanho}`);
        await sock.sendMessage(remoteJid, {
            text: `🏆 *${estado.nick}* VENCEU a IA *${estado.nivel.nome}* no turno *${estado.turno}*!\n\n✨ +${xpGanho} XP ganho!`
        });
        return true;
    }
    return false;
}

// ─── SALVAR ESTRATÉGIA (IA aprende) ──────────────────────
function _salvarEstrategia(jogador, acao, resultado) {
    try {
        db.prepare(`INSERT INTO ia_estrategias (jogador, acao, resultado) VALUES (?, ?, ?)`)
          .run(jogador, acao, resultado);
    } catch (_) {}
}

// ─── CARREGAR CARDS DO JOGADOR ───────────────────────────
function _carregarCards(jid) {
    return db.prepare('SELECT * FROM cards WHERE dono_jid = ?').all(jid) || [];
}
