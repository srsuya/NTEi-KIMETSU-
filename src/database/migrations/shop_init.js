import db from '../connection.js';

export function runShopMigrations() {
    // Criação das tabelas da Loja
    db.exec(`
        CREATE TABLE IF NOT EXISTS itens_loja (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL,
            preco INTEGER NOT NULL,
            moeda TEXT NOT NULL, -- 'IENES' ou 'FICHAS'
            limite INTEGER DEFAULT -1, -- -1 significa infinito
            restricao_raca TEXT DEFAULT 'Ambos'
        );

        CREATE TABLE IF NOT EXISTS compras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jogador_jid TEXT NOT NULL,
            item_nome TEXT NOT NULL,
            quantidade INTEGER NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(jogador_jid) REFERENCES jogadores(jid) ON DELETE CASCADE
        );
    `);

    // Inserção dos 18 Itens Oficiais do Prompt Mestre
    const itensOficiais = [
        ['👥 Corações Gêmeos', 500, 'IENES', -1, 'Ambos'],
        ['🎊 Chuva de Festim', 200, 'IENES', -1, 'Ambos'],
        ['🐦‍⬛ Miragem dos Corvos', 800, 'IENES', -1, 'Ambos'],
        ['🏷️ Selo Arcano', 1500, 'IENES', -1, 'Ambos'],
        ['🪞 Duplicata', 2000, 'IENES', -1, 'Ambos'],
        ['⚫ Absorção de Sombra', 2500, 'IENES', -1, 'Ambos'],
        ['👤 Muralha Viva', 1200, 'IENES', -1, 'Ambos'],
        ['🧛形‍♂️ Sede Vampírica', 3000, 'IENES', -1, 'Ambos'],
        ['🔘 Vontade dos Hashiras', 50, 'FICHAS', 1, 'Humano'],
        ['⛔🛑 Vontade dos Luas', 50, 'FICHAS', 1, 'Oni'],
        ['🎴 Brinco do Tanjiro', 100, 'FICHAS', 1, 'Humano'],
        ['🔝🏷️ Up Selo Arcano', 300, 'FICHAS', -1, 'Ambos'],
        ['🔝🪞 Up Duplicata', 400, 'FICHAS', -1, 'Ambos'],
        ['🔝🧛形‍♂️ Up Sede Vampírica', 500, 'FICHAS', -1, 'Ambos'],
        ['🍬 Resgate Natal', 10, 'FICHAS', 1, 'Ambos'],
        ['🦠 Resgate Corrompido', 15, 'FICHAS', 1, 'Ambos'],
        ['🌟 Resgate Missão Especial', 25, 'FICHAS', -1, 'Ambos']
    ];

    const stmt = db.prepare('INSERT OR IGNORE INTO itens_loja (nome, preco, moeda, limite, restricao_raca) VALUES (?, ?, ?, ?, ?)');
    for (const item of itensOficiais) {
        stmt.run(item[0], item[1], item[2], item[3], item[4]);
    }
}
