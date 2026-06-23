import { CONFIG } from '../config/config.js';
import { lerJSON, salvarJSON, dataAtual } from '../utils/jsonStore.js';

const VALOR_INICIAL = { lista: [] };

function carregar() {
    return lerJSON(CONFIG.paths.placares, VALOR_INICIAL);
}

function salvar(db) {
    salvarJSON(CONFIG.paths.placares, db);
}

function criarPlacar({ tipo, jogador1, jogador2 }) {
    const db = carregar();
    const placar = {
        id: db.lista.length + 1,
        tipo, // 'vt' ou 'sc'
        data: dataAtual(),
        jogador1: { ...jogador1 }, // { idRpg, nome, familia, patente, hp, hpMax, energia, energiaMax }
        jogador2: { ...jogador2 },
        log: [],
        finalizado: false,
        vencedor: null
    };
    db.lista.push(placar);
    salvar(db);
    return placar;
}

function buscarPlacarAberto(jid) {
    const db = carregar();
    return db.lista.find(p => !p.finalizado && (p.jogador1.jid === jid || p.jogador2.jid === jid)) || null;
}

function atualizarPlacar(id, dadosParciais) {
    const db = carregar();
    const idx = db.lista.findIndex(p => p.id === id);
    if (idx === -1) return null;
    db.lista[idx] = { ...db.lista[idx], ...dadosParciais };
    salvar(db);
    return db.lista[idx];
}

export const PlacaresDB = {
    criarPlacar,
    buscarPlacarAberto,
    atualizarPlacar
};
