import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../database_json.json');

// Inicializa o arquivo JSON caso ele não exista
if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify({ jogadores: [], inventario: [], compras: [], itens_loja: [] }, null, 2));
}

// Helper para ler e salvar os dados de forma síncrona
const readData = () => JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
const writeData = (data) => fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));

const db = {
    prepare: (sql) => {
        const sqlClean = sql.toLowerCase().replace(/\s+/g, ' ').trim();

        return {
            get: (...params) => {
                const data = readData();
                if (sqlClean.includes('from jogadores where jid = ?') || sqlClean.includes('from jogadores where jid=?')) {
                    return data.jogadores.find(j => j.jid === params[0]) || null;
                }
                if (sqlClean.includes('from jogadores where id_rpg = ?')) {
                    return data.jogadores.find(j => j.id_rpg == params[0]) || null;
                }
                if (sqlClean.includes('max(id_rpg)')) {
                    if (data.jogadores.length === 0) return { id: 1000 };
                    const maxId = Math.max(...data.jogadores.map(j => j.id_rpg || 1000));
                    return { id: maxId };
                }
                return null;
            },
            run: (...params) => {
                const data = readData();
                if (sqlClean.includes('insert into jogadores')) {
                    const novoJogador = {
                        jid: params[0], id_rpg: params[1], nick: params[2],
                        raca: params[3], patente: params[4], familia: params[5], vila: params[6],
                        hp: 100, max_hp: 100, chakra: 100, max_chakra: 100, xp: 0, ienes: 0, fichas: 0
                    };
                    data.jogadores.push(novoJogador);
                    writeData(data);
                    return { changes: 1 };
                }
                if (sqlClean.includes('update jogadores set patente = ?')) {
                    const jog = data.jogadores.find(j => j.id_rpg == params[1]);
                    if (jog) { jog.patente = params[0]; writeData(data); return { changes: 1 }; }
                }
                return { changes: 0 };
            },
            all: (...params) => {
                const data = readData();
                if (sqlClean.includes('select * from itens_loja')) {
                    return data.itens_loja.filter(i => i.moeda === params[0]);
                }
                return [];
            }
        };
    },
    exec: (sql) => Promise.resolve(),
    transaction: (fn) => () => fn()
};

export default db;
