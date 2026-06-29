import db from '../connection.js';

export function runMigrations() {
    // Cria a tabela de jogadores com todos os atributos do perfil
    db.prepare(`
        CREATE TABLE IF NOT EXISTS jogadores (
            jid TEXT PRIMARY KEY,
            id_rpg INTEGER,
            nick TEXT,
            raca TEXT DEFAULT 'Indefinida',
            patente TEXT DEFAULT '⏺️ Cidadão',
            familia TEXT DEFAULT 'Nenhuma',
            nacao TEXT DEFAULT 'Nenhuma',
            vila TEXT DEFAULT 'Nenhuma',
            recrutador TEXT DEFAULT 'Sistema',
            hp INTEGER DEFAULT 100,
            max_hp INTEGER DEFAULT 100,
            chakra INTEGER DEFAULT 100,
            max_chakra INTEGER DEFAULT 100,
            xp INTEGER DEFAULT 0,
            ienes INTEGER DEFAULT 0,
            fichas INTEGER DEFAULT 0
        )
    `).run();

    console.log("✅ Tabela de jogadores treinada e inicializada no SQLite!");
}
