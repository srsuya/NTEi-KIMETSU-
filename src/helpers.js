// ──────────────────────────────────────────────────────────
//  UTILITÁRIOS GERAIS
// ──────────────────────────────────────────────────────────

import db from '../database/connection.js';

// ─── EXTRAIR TEXTO DA MENSAGEM ────────────────────────────
export function extractText(msg) {
    const m = msg.message;
    if (!m) return '';
    const inner =
        m.ephemeralMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m.documentWithCaptionMessage?.message ||
        m;
    return (
        inner.conversation ||
        inner.extendedTextMessage?.text ||
        inner.imageMessage?.caption ||
        inner.videoMessage?.caption ||
        inner.buttonsResponseMessage?.selectedButtonId ||
        inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    ).trim();
}

// ─── EXTRAIR MENCIONADOS ──────────────────────────────────
export function getMentioned(msg) {
    return msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
}

// ─── EXTRAIR CAMPO DE FICHA ───────────────────────────────
export function extrairCampo(lines, ...termos) {
    for (const termo of termos) {
        const linha = lines.find(l => l.toLowerCase().includes(termo.toLowerCase()));
        if (linha) {
            const partes = linha.split(/[:\⌊\⌉]/);
            for (let i = partes.length - 1; i >= 0; i--) {
                const val = partes[i]
                    .replace(/[⌊⌉◈￫🆔🧾⛩️🏙️🔘✒️🧬]/g, '')
                    .trim();
                if (val && val.length > 0) return val;
            }
        }
    }
    return null;
}

// ─── NÍVEL DE ACESSO ──────────────────────────────────────
export function getNivel(sender, OWNER_JID) {
    const jidLimpo = sender.split('@')[0] + '@s.whatsapp.net';
    if (jidLimpo === OWNER_JID || sender === OWNER_JID) return 'ntei';
    try {
        const row =
            db.prepare('SELECT nivel FROM admins WHERE jid = ?').get(sender) ||
            db.prepare('SELECT nivel FROM admins WHERE jid = ?').get(jidLimpo);
        return row?.nivel || 'user';
    } catch { return 'user'; }
}

// ─── PRÓXIMO ID RPG ───────────────────────────────────────
export function proximoIdRpg() {
    const row = db.prepare('SELECT MAX(id_rpg) as m FROM jogadores').get();
    return (row?.m || 999) + 1;
}

// ─── FORMATAR NÚMERO ─────────────────────────────────────
export function fmtNum(n) {
    return Number(n || 0).toLocaleString('pt-BR');
}

// ─── BARRA DE PROGRESSO ──────────────────────────────────
export function barHP(atual, max, size = 10) {
    const pct = Math.min(1, Math.max(0, atual / max));
    const fill = Math.round(pct * size);
    return '█'.repeat(fill) + '░'.repeat(size - fill);
}

// ─── DELAY ───────────────────────────────────────────────
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ─── LOG NO BANCO ────────────────────────────────────────
export function logDB(tipo, ator = '', alvo = '', detalhe = '') {
    try {
        db.prepare(`INSERT INTO logs (tipo, ator, alvo, detalhe) VALUES (?, ?, ?, ?)`)
          .run(tipo, ator, alvo, detalhe);
    } catch (_) {}
}

// ─── ANTI-FLOOD ──────────────────────────────────────────
const floodMap = new Map();
const FLOOD_LIMIT  = 7;
const FLOOD_WINDOW = 6000;
const FLOOD_BAN    = 5 * 60 * 1000;

export function checkFlood(sender) {
    const now  = Date.now();
    const data = floodMap.get(sender);
    if (data?.banned && now < data.bannedUntil) return { bloqueado: true, restante: Math.ceil((data.bannedUntil - now) / 60000) };
    if (!data || now - data.start > FLOOD_WINDOW) {
        floodMap.set(sender, { count: 1, start: now, banned: false, avisado: false });
        return { bloqueado: false };
    }
    data.count++;
    if (data.count >= FLOOD_LIMIT) {
        data.banned    = true;
        data.bannedUntil = now + FLOOD_BAN;
        const restante = Math.ceil(FLOOD_BAN / 60000);
        return { bloqueado: true, restante, novo: !data.avisado, set: () => { data.avisado = true; } };
    }
    return { bloqueado: false };
}

// ─── ANTI-LINK ───────────────────────────────────────────
export const LINK_REGEX = /(https?:\/\/|www\.|chat\.whatsapp\.com)/i;

// ─── BORDAS DO BOT ───────────────────────────────────────
export const BORDA_TOPO = `➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄`;
export const BORDA_BOT  = `➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄`;
export const TITULO     = `   🤺 ᗂ ⛩️ Kimetsu New Age ⛩️ ᗃ 🤺`;
