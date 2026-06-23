import { CONFIG } from '../config/config.js';
import { lerJSON, salvarJSON } from '../utils/jsonStore.js';

const VALOR_INICIAL = { baralhos: {} };

function carregar() {
    return lerJSON(CONFIG.paths.cards, VALOR_INICIAL);
}

function salvar(db) {
    salvarJSON(CONFIG.paths.cards, db);
}

/**
 * Salva o baralho de 18 cards de um jogador.
 * cards: array de objetos { nome, tipo, valor, custoEnergia }
 */
function salvarBaralho(jid, cards) {
    const db = carregar();
    db.baralhos[jid] = { cards, atualizadoEm: new Date().toISOString() };
    salvar(db);
    return db.baralhos[jid];
}

function buscarBaralho(jid) {
    const db = carregar();
    return db.baralhos[jid] || null;
}

export const CardsDB = {
    salvarBaralho,
    buscarBaralho
};
