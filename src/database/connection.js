import { Database } from 'node:sqlite'; // Usa o motor SQLite nativo do próprio Node.js
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/kimetsu.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// Abre a conexão nativa
const db = new Database(DB_PATH);

export default db;
