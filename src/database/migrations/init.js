// src/database/migrations/init.js
import db from '../connection.js';

export function runMigrations() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS jogadores (
            jid TEXT PRIMARY KEY,
            id_rpg INTEGER UNIQUE NOT NULL,
            nick TEXT NOT NULL,
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
            nivel INTEGER DEFAULT 1,
            ienes INTEGER DEFAULT 0,
            engrenagens INTEGER DEFAULT 0,
            fichas INTEGER DEFAULT 0,
            kekkijutsu TEXT DEFAULT 'Nenhum',
            respiracao TEXT DEFAULT 'Nenhuma',
            cards_formatados TEXT DEFAULT '',
            dificuldade_ia TEXT DEFAULT 'medio',
            advertencias INTEGER DEFAULT 0,
            banido INTEGER DEFAULT 0,
            mutado INTEGER DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS inventario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jogador_jid TEXT NOT NULL,
            item_nome TEXT NOT NULL,
            quantidade INTEGER DEFAULT 1,
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(jogador_jid) REFERENCES jogadores(jid) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS inventario_texto (
            jogador_jid TEXT PRIMARY KEY,
            conteudo TEXT DEFAULT '',
            atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(jogador_jid) REFERENCES jogadores(jid) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS historico_financeiro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            jogador_jid TEXT NOT NULL,
            tipo TEXT NOT NULL,
            valor INTEGER NOT NULL,
            operacao TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(jogador_jid) REFERENCES jogadores(jid) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS transferencias (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            remetente_jid TEXT NOT NULL,
            destinatario_jid TEXT NOT NULL,
            valor INTEGER NOT NULL,
            motivo TEXT DEFAULT '',
            estornada INTEGER DEFAULT 0,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS admins (
            jid TEXT PRIMARY KEY,
            nivel TEXT DEFAULT 'admin'
        );

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            descricao TEXT NOT NULL,
            autor TEXT,
            alvo TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS lutas (
            id_luta INTEGER PRIMARY KEY AUTOINCREMENT,
            jogador1_jid TEXT NOT NULL,
            jogador2_jid TEXT,
            modo TEXT NOT NULL,
            hp1 INTEGER DEFAULT 100,
            hp2 INTEGER DEFAULT 100,
            status TEXT DEFAULT 'em_andamento',
            vencedor_jid TEXT,
            criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
            finalizado_em DATETIME
        );

        CREATE INDEX IF NOT EXISTS idx_jogadores_id_rpg ON jogadores(id_rpg);
        CREATE INDEX IF NOT EXISTS idx_logs_tipo ON logs(tipo);
    `);
}
