import db from '../connection.js';
import logger from '../../utils/logger.js';

export function runAllMigrations() {
    logger.info('Executando migrations do banco de dados...');

    // ─── JOGADORES ────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS jogadores (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        id_rpg      INTEGER UNIQUE NOT NULL,
        jid         TEXT UNIQUE NOT NULL,
        nick        TEXT NOT NULL,
        raca        TEXT DEFAULT 'Indefinida',
        familia     TEXT DEFAULT 'Nenhuma',
        patente     TEXT DEFAULT '⏺️ Cidadão',
        nacao       TEXT DEFAULT 'Nenhuma',
        vila        TEXT DEFAULT 'Nenhuma',
        recrutador  TEXT DEFAULT 'Sistema',
        xp          INTEGER DEFAULT 0,
        nivel       INTEGER DEFAULT 1,
        hp          INTEGER DEFAULT 100,
        max_hp      INTEGER DEFAULT 100,
        chakra      INTEGER DEFAULT 100,
        max_chakra  INTEGER DEFAULT 100,
        ienes       INTEGER DEFAULT 0,
        engrenagens INTEGER DEFAULT 0,
        fichas      INTEGER DEFAULT 0,
        inventario  TEXT DEFAULT '',
        cards       TEXT DEFAULT '[]',
        historico   TEXT DEFAULT '[]',
        criado_em   TEXT DEFAULT (datetime('now','localtime')),
        atualizado_em TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── ADMINS ───────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS admins (
        jid     TEXT PRIMARY KEY,
        nivel   TEXT DEFAULT 'admin',
        adicionado_em TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── TRANSFERÊNCIAS ───────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS transferencias (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        remetente   TEXT NOT NULL,
        destinatario TEXT NOT NULL,
        valor       INTEGER NOT NULL,
        motivo      TEXT DEFAULT '',
        tipo        TEXT DEFAULT 'ienes',
        cancelada   INTEGER DEFAULT 0,
        criado_em   TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── LOJAS ────────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS lojas (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo        TEXT UNIQUE NOT NULL,
        conteudo    TEXT NOT NULL,
        atualizado_por TEXT DEFAULT '',
        atualizado_em TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── ITENS DE LOJA ────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS itens_loja (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nome        TEXT NOT NULL,
        descricao   TEXT DEFAULT '',
        preco       INTEGER NOT NULL,
        moeda       TEXT DEFAULT 'ienes',
        estoque     INTEGER DEFAULT -1,
        ativo       INTEGER DEFAULT 1
    )`).run();

    // ─── LUTAS ────────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS lutas (
        id_luta     INTEGER PRIMARY KEY AUTOINCREMENT,
        jogador1    TEXT NOT NULL,
        jogador2    TEXT NOT NULL,
        hp1         INTEGER DEFAULT 100,
        hp2         INTEGER DEFAULT 100,
        energia1    INTEGER DEFAULT 100,
        energia2    INTEGER DEFAULT 100,
        turno       INTEGER DEFAULT 1,
        status      TEXT DEFAULT 'ativa',
        tipo        TEXT DEFAULT 'plc',
        vencedor    TEXT DEFAULT '',
        log         TEXT DEFAULT '[]',
        criado_em   TEXT DEFAULT (datetime('now','localtime')),
        finalizado_em TEXT DEFAULT ''
    )`).run();

    // ─── CARDS ────────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS cards (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        dono_jid    TEXT NOT NULL,
        nome        TEXT NOT NULL,
        descricao   TEXT DEFAULT '',
        tipo        TEXT DEFAULT 'ataque',
        dano        INTEGER DEFAULT 0,
        buff        INTEGER DEFAULT 0,
        debuff      INTEGER DEFAULT 0,
        raridade    TEXT DEFAULT 'comum',
        criado_em   TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── LOGS GERAIS ─────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS logs (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo        TEXT NOT NULL,
        ator        TEXT DEFAULT '',
        alvo        TEXT DEFAULT '',
        detalhe     TEXT DEFAULT '',
        criado_em   TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── IA ESTRATÉGIAS ───────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS ia_estrategias (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        jogador     TEXT NOT NULL,
        acao        TEXT NOT NULL,
        resultado   TEXT DEFAULT '',
        pontos      INTEGER DEFAULT 0,
        criado_em   TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── ANÚNCIOS ─────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS anuncios (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        titulo      TEXT NOT NULL,
        texto       TEXT NOT NULL,
        assinatura  TEXT DEFAULT '',
        enviado_por TEXT DEFAULT '',
        criado_em   TEXT DEFAULT (datetime('now','localtime'))
    )`).run();

    // ─── FAMÍLIAS ─────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS familias (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        nome        TEXT UNIQUE NOT NULL,
        descricao   TEXT DEFAULT '',
        lider_jid   TEXT DEFAULT '',
        membros     INTEGER DEFAULT 0,
        ativo       INTEGER DEFAULT 1
    )`).run();

    // Inserir famílias padrão
    const familiasPadrao = [
        ['Tomioka', 'Clã da Água'],
        ['Rengoku', 'Clã do Fogo'],
        ['Uzui', 'Clã do Som'],
        ['Shinobu', 'Clã do Veneno'],
        ['Mitsuri', 'Clã do Amor'],
        ['Gyomei', 'Clã da Pedra'],
        ['Muichiro', 'Clã da Névoa'],
        ['Sanemi', 'Clã do Vento'],
        ['Obanai', 'Clã da Cobra'],
    ];

    const insStmt = db.prepare(`INSERT OR IGNORE INTO familias (nome, descricao) VALUES (?, ?)`);
    for (const [nome, desc] of familiasPadrao) {
        insStmt.run(nome, desc);
    }

    // ─── COLUNAS EXTRAS (retrocompatibilidade) ────────
    const alterSafe = (sql) => { try { db.prepare(sql).run(); } catch (_) {} };
    alterSafe(`ALTER TABLE jogadores ADD COLUMN raca TEXT DEFAULT 'Indefinida'`);
    alterSafe(`ALTER TABLE jogadores ADD COLUMN recrutador TEXT DEFAULT ''`);
    alterSafe(`ALTER TABLE jogadores ADD COLUMN nacao TEXT DEFAULT ''`);
    alterSafe(`ALTER TABLE jogadores ADD COLUMN engrenagens INTEGER DEFAULT 0`);
    alterSafe(`ALTER TABLE jogadores ADD COLUMN cards TEXT DEFAULT '[]'`);
    alterSafe(`ALTER TABLE jogadores ADD COLUMN historico TEXT DEFAULT '[]'`);

    // ─── SORTEIOS ─────────────────────────────────────────
    db.prepare(`CREATE TABLE IF NOT EXISTS sorteios (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        nome         TEXT NOT NULL,
        tipo         TEXT NOT NULL,
        raridade     TEXT NOT NULL,
        slots_total  INTEGER NOT NULL,
        slots_usados INTEGER DEFAULT 0,
        ativo        INTEGER DEFAULT 1
    )`).run();

    db.prepare(`CREATE TABLE IF NOT EXISTS sorteios_jogadores (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        jid             TEXT NOT NULL,
        tipo_sorteio    TEXT NOT NULL,
        habilidade_nome TEXT NOT NULL,
        habilidade_emoji TEXT NOT NULL,
        raridade        TEXT NOT NULL,
        dado            INTEGER NOT NULL,
        criado_em       TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(jid, tipo_sorteio)
    )`).run();

    logger.info('Migrations concluídas com sucesso!');
}
