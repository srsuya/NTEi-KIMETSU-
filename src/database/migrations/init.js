import db from '../connection.js';

export function runMigrations() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS jogadores (
            jid TEXT PRIMARY KEY,
            id_rpg INTEGER UNIQUE,
            nick TEXT,
            raca TEXT DEFAULT 'Humano',
            patente TEXT DEFAULT '⏺️ Cidadão',
            familia TEXT DEFAULT 'Nenhuma',
            vila TEXT DEFAULT 'Nenhuma',
            hp INTEGER DEFAULT 100,
            max_hp INTEGER DEFAULT 100,
            chakra INTEGER DEFAULT 100,
            max_chakra INTEGER DEFAULT 100,
            xp INTEGER DEFAULT 0,
            ienes INTEGER DEFAULT 0,
            fichas INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jogador_jid TEXT,
            item_nome TEXT,
            quantidade INTEGER DEFAULT 0,
            FOREIGN KEY(jogador_jid) REFERENCES jogadores(jid) ON DELETE CASCADE
        );
    `);
}
