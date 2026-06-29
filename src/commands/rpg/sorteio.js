import db from '../../database/connection.js';
import { logDB, BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

// ══════════════════════════════════════════════════════════
//   SISTEMA DE SORTEIO — KEKKIJUTSU & RESPIRAÇÃO
// ══════════════════════════════════════════════════════════

// ─── RARIDADES (faixas de 1 a 100) ──────────────────────
const RARIDADES = [
    { key: 'secreta',  nome: '⚫ Secreta',   emoji: '⚫', faixaMin: 1,  faixaMax: 1,  slots: 1 },
    { key: 'lendaria', nome: '🟡 Lendária',  emoji: '🟡', faixaMin: 2,  faixaMax: 7,  slots: 2 },
    { key: 'mitica',   nome: '🔴 Mítica',    emoji: '🔴', faixaMin: 8,  faixaMax: 25, slots: 4 },
    { key: 'epica',    nome: '🟣 Épica',     emoji: '🟣', faixaMin: 26, faixaMax: 55, slots: 6 },
    { key: 'rara',     nome: '🔵 Rara',      emoji: '🔵', faixaMin: 56, faixaMax: 100,slots: 8 },
];

// ─── POOL DE HABILIDADES ─────────────────────────────────
const HABILIDADES = {
    secreta: [
        { nome: 'Kekkijutsu do Rei',     emoji: '👑', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu da Kitsune', emoji: '🦊', tipo: 'kekkijutsu' },
        { nome: 'Respiração Angelical',  emoji: '🪽', tipo: 'respiracao' },
        { nome: 'Respiração do Eclipse', emoji: '🌑', tipo: 'respiracao' },
    ],
    lendaria: [
        { nome: 'Kekkijutsu da Morte Destrutiva', emoji: '🧭', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Gelo',             emoji: '❄️', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu Ondas de Choque',     emoji: '🔘', tipo: 'kekkijutsu' },
        { nome: 'Respiração da Lua',              emoji: '🌙', tipo: 'respiracao' },
        { nome: 'Respiração do Sol',              emoji: '🔆', tipo: 'respiracao' },
        { nome: 'Respiração da Pedra',            emoji: '🪨', tipo: 'respiracao' },
        { nome: 'Respiração da Morte',            emoji: '💀', tipo: 'respiracao' },
        { nome: 'Respiração do Dragão',           emoji: '🐲', tipo: 'respiracao' },
    ],
    mitica: [
        { nome: 'Respiração da Água (Tomioka)', emoji: '🌊', tipo: 'respiracao' },
        { nome: 'Respiração da Névoa',          emoji: '🌫️', tipo: 'respiracao' },
        { nome: 'Respiração da Fera',           emoji: '🌀', tipo: 'respiracao' },
        { nome: 'Respiração da Neve',           emoji: '❄️', tipo: 'respiracao' },
        { nome: 'Respiração da Aurora',         emoji: '🌅', tipo: 'respiracao' },
        { nome: 'Respiração do Sangue',         emoji: '🩸', tipo: 'respiracao' },
        { nome: 'Kekkijutsu da Emoção',         emoji: '💫', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu dos Peixes',        emoji: '🐠', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Sangue Venenoso',emoji: '🩸', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Sangue Explosivo',emoji:'💥', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Raio Negro',     emoji: '⚡', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu das Memórias',      emoji: '🔯', tipo: 'kekkijutsu' },
    ],
    epica: [
        { nome: 'Respiração do Vento',      emoji: '🌪️', tipo: 'respiracao' },
        { nome: 'Respiração das Chamas',    emoji: '🔥', tipo: 'respiracao' },
        { nome: 'Respiração da Serpente',   emoji: '🐍', tipo: 'respiracao' },
        { nome: 'Respiração do Som',        emoji: '🔊', tipo: 'respiracao' },
        { nome: 'Respiração do Amor',       emoji: '💞', tipo: 'respiracao' },
        { nome: 'Respiração da Estrela',    emoji: '🌟', tipo: 'respiracao' },
        { nome: 'Respiração da Rosa',       emoji: '🌹', tipo: 'respiracao' },
        { nome: 'Respiração da Escuridão',  emoji: '🌑', tipo: 'respiracao' },
        { nome: 'Kekkijutsu dos Sonhos',    emoji: '💤', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu das Aranhas',   emoji: '🕷️', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu das Sombras',   emoji: '👁️‍🗨️',tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu das Faixas Obi',emoji: '🎀', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu da Biwa',       emoji: '🎻', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu dos Cortes',    emoji: '🗡️', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu dos Espelhos',  emoji: '🪞', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu das Marionetes',emoji: '🧸', tipo: 'kekkijutsu' },
    ],
    rara: [
        { nome: 'Respiração da Água',   emoji: '💧', tipo: 'respiracao' },
        { nome: 'Respiração do Trovão', emoji: '⚡', tipo: 'respiracao' },
        { nome: 'Respiração do Inseto', emoji: '🦋', tipo: 'respiracao' },
        { nome: 'Respiração da Flor',   emoji: '🌸', tipo: 'respiracao' },
        { nome: 'Respiração da Teia',   emoji: '🕸️', tipo: 'respiracao' },
        { nome: 'Respiração dos Pássaros',emoji:'🪶', tipo: 'respiracao' },
        { nome: 'Respiração do Broto',  emoji: '🌱', tipo: 'respiracao' },
        { nome: 'Kekkijutsu da Flor',   emoji: '🌸', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu da Temari', emoji: '⚽', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu da Seta',   emoji: '🔁', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Tambor', emoji: '🪘', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu da Cobra',  emoji: '🐍', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Papel',  emoji: '🎐', tipo: 'kekkijutsu' },
        { nome: 'Kekkijutsu do Olho',   emoji: '🧿', tipo: 'kekkijutsu' },
    ],
};

// ─── MIGRAÇÃO DA TABELA DE SORTEIOS ──────────────────────
export function migrarSorteios() {
    db.prepare(`CREATE TABLE IF NOT EXISTS sorteios (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nome        TEXT NOT NULL,
        tipo        TEXT NOT NULL,
        raridade    TEXT NOT NULL,
        slots_total INTEGER NOT NULL,
        slots_usados INTEGER DEFAULT 0,
        ativo       INTEGER DEFAULT 1
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS sorteios_jogadores (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        jid         TEXT NOT NULL,
        tipo_sorteio TEXT NOT NULL,
        habilidade_nome TEXT NOT NULL,
        habilidade_emoji TEXT NOT NULL,
        raridade    TEXT NOT NULL,
        dado        INTEGER NOT NULL,
        criado_em   TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(jid, tipo_sorteio)
    )`).run();

    // Popular tabela de habilidades se vazia
    const count = db.prepare('SELECT COUNT(*) as c FROM sorteios').get();
    if (count.c === 0) {
        _popularHabilidades();
    }
}

function _popularHabilidades() {
    const stmt = db.prepare(`INSERT INTO sorteios (nome, tipo, raridade, slots_total) VALUES (?, ?, ?, ?)`);
    for (const [rarKey, lista] of Object.entries(HABILIDADES)) {
        const rar = RARIDADES.find(r => r.key === rarKey);
        for (const hab of lista) {
            stmt.run(hab.nome, hab.tipo, rarKey, rar.slots);
        }
    }
}

// ─── FUNÇÃO PRINCIPAL DE SORTEIO ─────────────────────────
export async function commandSortear(sock, remoteJid, sender, tipoForcado = null) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Você não tem perfil! Envie a ficha de recrutamento.` }); return; }

    // Tipo: 'kekkijutsu' ou 'respiracao' ou null (sorteia ambos se não tiver)
    const jaTemKekki = db.prepare(`SELECT * FROM sorteios_jogadores WHERE jid = ? AND tipo_sorteio = 'kekkijutsu'`).get(sender);
    const jaTemResp  = db.prepare(`SELECT * FROM sorteios_jogadores WHERE jid = ? AND tipo_sorteio = 'respiracao'`).get(sender);

    if (jaTemKekki && jaTemResp) {
        await sock.sendMessage(remoteJid, {
            text:
`❌ @${sender.split('@')[0]}, você já realizou seus sorteios!\n\n` +
`${jaTemKekki.habilidade_emoji} *Kekkijutsu:* ${jaTemKekki.habilidade_nome} (${_nomeRaridade(jaTemKekki.raridade)})\n` +
`${jaTemResp.habilidade_emoji} *Respiração:* ${jaTemResp.habilidade_nome} (${_nomeRaridade(jaTemResp.raridade)})\n\n` +
`Use */minhasort* para ver detalhes.`,
            mentions: [sender]
        });
        return;
    }

    const resultados = [];

    // Sortear Kekkijutsu se não tiver
    if (!jaTemKekki && (tipoForcado === null || tipoForcado === 'kekkijutsu')) {
        const res = await _realizarSorteio(sender, 'kekkijutsu');
        if (res) resultados.push(res);
    }

    // Sortear Respiração se não tiver
    if (!jaTemResp && (tipoForcado === null || tipoForcado === 'respiracao')) {
        const res = await _realizarSorteio(sender, 'respiracao');
        if (res) resultados.push(res);
    }

    if (!resultados.length) {
        await sock.sendMessage(remoteJid, { text: `⚠️ Sem sorteios disponíveis para você agora.` }); return;
    }

    logDB('sorteio', sender, '', resultados.map(r => r.nome).join(' | '));

    // Montar mensagem de resultado
    let msg = `${BORDA_TOPO}\n${TITULO}\n   🎲 *RESULTADO DO SORTEIO!* 🎲\n\n`;
    msg += `👤 *${j.nick}* (ID: ${j.id_rpg})\n\n`;

    for (const r of resultados) {
        msg += `${'─'.repeat(30)}\n`;
        msg += `🎯 *${r.tipoNome}*\n`;
        msg += `🎲 Dado: *${r.dado}*\n`;
        msg += `${r.raridadeEmoji} Raridade: *${r.raridadeNome}*\n`;
        msg += `${r.emoji} Habilidade: *${r.nome}*\n\n`;
    }

    msg += `${'─'.repeat(30)}\n`;

    // Alerta especial para raridades altas
    const temSecreta  = resultados.some(r => r.raridade === 'secreta');
    const temLendaria = resultados.some(r => r.raridade === 'lendaria');
    if (temSecreta)  msg += `\n🌟✨ *INCRÍVEL! HABILIDADE SECRETA!* ✨🌟\n`;
    if (temLendaria) msg += `\n🏆 *PARABÉNS! HABILIDADE LENDÁRIA!* 🏆\n`;

    msg += `\nUse */minhasort* para ver suas habilidades.\n${BORDA_BOT}`;

    await sock.sendMessage(remoteJid, { text: msg, mentions: [sender] });
}

// ─── VER MINHAS HABILIDADES ──────────────────────────────
export async function commandMinhaSorte(sock, remoteJid, sender) {
    const j = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Sem perfil!` }); return; }

    const sorteios = db.prepare(`SELECT * FROM sorteios_jogadores WHERE jid = ? ORDER BY tipo_sorteio`).all(sender);
    if (!sorteios.length) {
        await sock.sendMessage(remoteJid, { text: `🎲 Você ainda não sorteou!\nUse */sortear* para sortear suas habilidades.` }); return;
    }

    let msg = `${BORDA_TOPO}\n${TITULO}\n   🎲 *HABILIDADES DE ${j.nick}*\n\n`;
    for (const s of sorteios) {
        const tipoNome = s.tipo_sorteio === 'kekkijutsu' ? '🧬 Kekkijutsu' : '💨 Respiração';
        msg += `${tipoNome}\n`;
        msg += `${s.habilidade_emoji} *${s.habilidade_nome}*\n`;
        msg += `${_nomeRaridade(s.raridade)} | 🎲 Dado: ${s.dado} | 📅 ${s.criado_em}\n\n`;
    }
    msg += BORDA_BOT;
    await sock.sendMessage(remoteJid, { text: msg });
}

// ─── VER HABILIDADE DE OUTRO JOGADOR ─────────────────────
export async function commandVerSort(sock, remoteJid, idStr) {
    const id = parseInt(idStr);
    if (!id) { await sock.sendMessage(remoteJid, { text: `❌ Uso: */versort [id]*` }); return; }
    const j = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(id);
    if (!j) { await sock.sendMessage(remoteJid, { text: `❌ Jogador ID ${id} não encontrado!` }); return; }

    const sorteios = db.prepare(`SELECT * FROM sorteios_jogadores WHERE jid = ?`).all(j.jid);
    if (!sorteios.length) {
        await sock.sendMessage(remoteJid, { text: `🎲 *${j.nick}* ainda não sorteou suas habilidades.` }); return;
    }
    let msg = `${BORDA_TOPO}\n${TITULO}\n   🔍 *HABILIDADES DE ${j.nick}* (ID: ${id})\n\n`;
    for (const s of sorteios) {
        msg += `${s.tipo_sorteio === 'kekkijutsu' ? '🧬 Kekkijutsu' : '💨 Respiração'}: ${s.habilidade_emoji} *${s.habilidade_nome}* — ${_nomeRaridade(s.raridade)}\n`;
    }
    msg += `\n${BORDA_BOT}`;
    await sock.sendMessage(remoteJid, { text: msg });
}

// ─── TABELA DE HABILIDADES (ranking) ─────────────────────
export async function commandTabelaSort(sock, remoteJid) {
    const rows = db.prepare(`
        SELECT s.nome, s.slots_total, s.slots_usados, s.raridade, s.tipo
        FROM sorteios s
        ORDER BY
            CASE s.raridade
                WHEN 'secreta'  THEN 1
                WHEN 'lendaria' THEN 2
                WHEN 'mitica'   THEN 3
                WHEN 'epica'    THEN 4
                WHEN 'rara'     THEN 5
            END, s.nome
    `).all();

    const grupos = { secreta: [], lendaria: [], mitica: [], epica: [], rara: [] };
    for (const r of rows) grupos[r.raridade]?.push(r);

    const emojiRar = { secreta: '⚫', lendaria: '🟡', mitica: '🔴', epica: '🟣', rara: '🔵' };
    const nomeRar  = { secreta: 'Secretas', lendaria: 'Lendárias', mitica: 'Míticas', epica: 'Épicas', rara: 'Raras' };

    let msg = `${BORDA_TOPO}\n${TITULO}\n  📋 *TABELA DE HABILIDADES* 📋\n\n`;

    for (const [key, lista] of Object.entries(grupos)) {
        if (!lista.length) continue;
        msg += `${emojiRar[key]} *${nomeRar[key]}*\n`;
        for (const h of lista) {
            const icone = HABILIDADES[key]?.find(x => x.nome === h.nome)?.emoji || '•';
            msg += `${icone} ${h.nome} ${h.slots_usados}/${h.slots_total}\n`;
        }
        msg += '\n';
    }

    msg += BORDA_BOT;
    await sock.sendMessage(remoteJid, { text: msg });
}

// ─── ADMIN: RESETAR SORTEIO ──────────────────────────────
export async function cmdResetSorteio(sock, remoteJid, msg, nivel) {
    if (nivel === 'user') { await sock.sendMessage(remoteJid, { text: `❌ Sem permissão.` }); return; }
    const mencionados = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
    if (!mencionados.length) { await sock.sendMessage(remoteJid, { text: `❌ Marque o usuário!` }); return; }
    const jid = mencionados[0];

    // Devolver slots
    const sorteios = db.prepare('SELECT * FROM sorteios_jogadores WHERE jid = ?').all(jid);
    for (const s of sorteios) {
        db.prepare(`UPDATE sorteios SET slots_usados = MAX(0, slots_usados - 1) WHERE nome = ?`).run(s.habilidade_nome);
    }
    db.prepare('DELETE FROM sorteios_jogadores WHERE jid = ?').run(jid);
    logDB('reset_sorteio', msg.key.participant || msg.key.remoteJid, jid, 'Sorteio resetado');

    await sock.sendMessage(remoteJid, {
        text: `✅ Sorteios de @${jid.split('@')[0]} resetados! Ele pode sortear novamente.`,
        mentions: [jid]
    });
}

// ─── LÓGICA INTERNA DO SORTEIO ────────────────────────────
async function _realizarSorteio(jid, tipo) {
    // Rolar dado 1–100
    const dado = Math.floor(Math.random() * 100) + 1;

    // Determinar raridade
    const rar = RARIDADES.find(r => dado >= r.faixaMin && dado <= r.faixaMax);
    if (!rar) return null;

    // Buscar habilidades disponíveis daquele tipo e raridade
    const disponiveis = db.prepare(`
        SELECT * FROM sorteios
        WHERE raridade = ? AND tipo = ? AND slots_usados < slots_total AND ativo = 1
    `).all(rar.key, tipo);

    if (!disponiveis.length) {
        // Fallback: tentar raridade inferior
        for (const rarFallback of [...RARIDADES].reverse()) {
            if (rarFallback.key === rar.key) continue;
            const fb = db.prepare(`
                SELECT * FROM sorteios
                WHERE raridade = ? AND tipo = ? AND slots_usados < slots_total AND ativo = 1
            `).all(rarFallback.key, tipo);
            if (fb.length) {
                return _sortearDaLista(fb, rarFallback, jid, tipo, dado);
            }
        }
        return null;
    }

    return _sortearDaLista(disponiveis, rar, jid, tipo, dado);
}

function _sortearDaLista(lista, rar, jid, tipo, dado) {
    const escolhida = lista[Math.floor(Math.random() * lista.length)];
    const habInfo   = HABILIDADES[rar.key]?.find(h => h.nome === escolhida.nome);
    const emoji     = habInfo?.emoji || '✨';

    // Registrar no banco
    db.prepare(`
        INSERT OR REPLACE INTO sorteios_jogadores
        (jid, tipo_sorteio, habilidade_nome, habilidade_emoji, raridade, dado)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(jid, tipo, escolhida.nome, emoji, rar.key, dado);

    db.prepare(`UPDATE sorteios SET slots_usados = slots_usados + 1 WHERE id = ?`).run(escolhida.id);

    return {
        nome: escolhida.nome,
        emoji,
        tipo,
        tipoNome: tipo === 'kekkijutsu' ? '🧬 Kekkijutsu' : '💨 Respiração',
        raridade: rar.key,
        raridadeNome: rar.nome,
        raridadeEmoji: rar.emoji,
        dado,
    };
}

function _nomeRaridade(key) {
    return RARIDADES.find(r => r.key === key)?.nome || key;
}
