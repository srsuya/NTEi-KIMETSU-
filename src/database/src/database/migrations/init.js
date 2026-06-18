import db from '../connection.js';

export function runMigrations() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS jogadores (
            jid TEXT PRIMARY KEY,
            id_rpg INTEGER UNIQUE NOT NULL,
            nick TEXT NOT NULL,
            raca TEXT NOT NULL,
            patente TEXT NOT NULL,
            familia TEXT NOT NULL,
            vila TEXT NOT NULL,
            hp INTEGER DEFAULT 100,
            max_hp INTEGER DEFAULT 100,
            chakra INTEGER DEFAULT 100,
            max_chakra INTEGER DEFAULT 100,
            xp INTEGER DEFAULT 0,
            ienes INTEGER DEFAULT 0,
            fichas INTEGER DEFAULT 0
        );
    `);
}
