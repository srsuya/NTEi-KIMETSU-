import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../database.db');

if (!fs.existsSync(path.dirname(dbPath))) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

// Configura o banco usando o sqlite3 tradicional compatível com Android
const dbRaw = new sqlite3.Database(dbPath);

// Cria um wrapper simples para simular o "prepare().get()" e "prepare().run()" que o resto do seu código usa
const db = {
    prepare: (sql) => {
        return {
            get: (...params) => {
                return new Promise((resolve, reject) => {
                    dbRaw.get(sql, params, (err, row) => {
                        if (err) reject(err);
                        else resolve(row);
                    });
                });
            },
            run: (...params) => {
                return new Promise((resolve, reject) => {
                    dbRaw.run(sql, params, function (err) {
                        if (err) reject(err);
                        else resolve({ changes: this.changes, lastID: this.lastID });
                    });
                });
            },
            all: (...params) => {
                return new Promise((resolve, reject) => {
                    dbRaw.all(sql, params, (err, rows) => {
                        if (err) reject(err);
                        else resolve(rows);
                    });
                });
            }
        };
    },
    exec: (sql) => {
        return new Promise((resolve, reject) => {
            dbRaw.exec(sql, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },
    transaction: (fn) => {
        return () => {
            dbRaw.serialize(() => {
                dbRaw.run("BEGIN TRANSACTION");
                try {
                    fn();
                    dbRaw.run("COMMIT");
                } catch (err) {
                    dbRaw.run("ROLLBACK");
                    throw err;
                }
            });
        };
    }
};

// Ativa as chaves estrangeiras
dbRaw.run('PRAGMA foreign_keys = ON');

export default db;
