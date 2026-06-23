import { CONFIG } from '../config/config.js';
import { lerJSON, salvarJSON, dataAtual, horaAtual } from '../utils/jsonStore.js';

const VALOR_INICIAL_ALDEIA = { ienes: 333830, atualizadoPor: 'Sistema', data: dataAtual(), hora: horaAtual() };
const VALOR_INICIAL_TRANSACOES = { lista: [] };

function carregarAldeia() {
    return lerJSON(CONFIG.paths.aldeia, VALOR_INICIAL_ALDEIA);
}

function salvarAldeia(dados) {
    salvarJSON(CONFIG.paths.aldeia, dados);
}

function ajustarIenesAldeia(delta, autor) {
    const aldeia = carregarAldeia();
    aldeia.ienes += delta;
    aldeia.atualizadoPor = autor;
    aldeia.data = dataAtual();
    aldeia.hora = horaAtual();
    salvarAldeia(aldeia);
    return aldeia;
}

function carregarTransacoes() {
    return lerJSON(CONFIG.paths.transacoes, VALOR_INICIAL_TRANSACOES);
}

function salvarTransacoes(dados) {
    salvarJSON(CONFIG.paths.transacoes, dados);
}

/**
 * Registra uma transação para histórico/extrato/reversão.
 * tipo: 'transferencia_ienes' | 'transferencia_fichas' | 'add_ienes' | 'rm_ienes' | 'add_eng' | 'rm_eng' | 'compra' | 'conversao'
 */
function registrarTransacao({ tipo, deId, deNome, paraId, paraNome, valor, motivo, autor }) {
    const db = carregarTransacoes();
    const transacao = {
        id: db.lista.length + 1,
        tipo,
        deId: deId ?? null,
        deNome: deNome ?? null,
        paraId: paraId ?? null,
        paraNome: paraNome ?? null,
        valor,
        motivo: motivo || '—',
        autor: autor || 'Sistema',
        data: dataAtual(),
        hora: horaAtual(),
        revertida: false
    };
    db.lista.push(transacao);
    salvarTransacoes(db);
    return transacao;
}

function buscarTransacao(id) {
    const db = carregarTransacoes();
    return db.lista.find(t => t.id === Number(id)) || null;
}

function marcarRevertida(id) {
    const db = carregarTransacoes();
    const t = db.lista.find(tr => tr.id === Number(id));
    if (!t) return null;
    t.revertida = true;
    salvarTransacoes(db);
    return t;
}

function listarTransacoesPorJogador(idRpg, limite = 20) {
    const db = carregarTransacoes();
    return db.lista
        .filter(t => t.deId === Number(idRpg) || t.paraId === Number(idRpg))
        .slice(-limite)
        .reverse();
}

function listarUltimasTransacoes(limite = 30) {
    const db = carregarTransacoes();
    return db.lista.slice(-limite).reverse();
}

export const EconomiaDB = {
    carregarAldeia,
    salvarAldeia,
    ajustarIenesAldeia,
    registrarTransacao,
    buscarTransacao,
    marcarRevertida,
    listarTransacoesPorJogador,
    listarUltimasTransacoes
};
