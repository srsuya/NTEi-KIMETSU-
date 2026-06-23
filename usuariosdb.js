import { CONFIG } from '../config/config.js';
import { lerJSON, salvarJSON } from '../utils/jsonStore.js';

const VALOR_INICIAL = { usuarios: {}, proximoId: 1001 };

function carregar() {
    return lerJSON(CONFIG.paths.usuarios, VALOR_INICIAL);
}

function salvar(db) {
    salvarJSON(CONFIG.paths.usuarios, db);
}

/**
 * Retorna o usuário pelo JID. NÃO cria automaticamente.
 * Use criarUsuario() para registrar um novo jogador.
 */
function buscarPorJid(jid) {
    const db = carregar();
    if (!db.usuarios[jid]) return null;
    return { jid, ...db.usuarios[jid] };
}

/**
 * Busca um usuário pelo ID numérico do RPG (ex: 1001).
 */
function buscarPorId(idRpg) {
    const db = carregar();
    const idNum = Number(idRpg);
    const jid = Object.keys(db.usuarios).find(j => db.usuarios[j].id_rpg === idNum);
    if (!jid) return null;
    return { jid, ...db.usuarios[jid] };
}

/**
 * Busca um usuário pelo nick (case-insensitive).
 */
function buscarPorNick(nick) {
    const db = carregar();
    const nickLower = nick.toLowerCase();
    const jid = Object.keys(db.usuarios).find(
        j => db.usuarios[j].nome.toLowerCase() === nickLower
    );
    if (!jid) return null;
    return { jid, ...db.usuarios[jid] };
}

/**
 * Cria um novo usuário. Retorna null se o JID já estiver cadastrado.
 */
function criarUsuario(jid, dadosParciais = {}) {
    const db = carregar();
    if (db.usuarios[jid]) return null;

    const novoId = db.proximoId;
    db.usuarios[jid] = {
        id_rpg: novoId,
        nome: dadosParciais.nome || 'Sem Nick',
        ienes: CONFIG.novoJogador.ienes,
        fichas: CONFIG.novoJogador.fichas,
        eng: CONFIG.novoJogador.eng,
        xp: CONFIG.novoJogador.xp,
        nivel: CONFIG.novoJogador.nivel,
        hp: CONFIG.novoJogador.hpMax,
        hpMax: CONFIG.novoJogador.hpMax,
        energia: CONFIG.novoJogador.energiaMax,
        energiaMax: CONFIG.novoJogador.energiaMax,
        raca: CONFIG.novoJogador.raca,
        familia: dadosParciais.familia || CONFIG.novoJogador.familia,
        nacao: dadosParciais.nacao || CONFIG.novoJogador.nacao,
        patente: CONFIG.novoJogador.patente,
        recrutador: dadosParciais.recrutador || CONFIG.novoJogador.recrutador,
        banido: false,
        mutado: false,
        criadoEm: new Date().toISOString()
    };
    db.proximoId = novoId + 1;
    salvar(db);
    return { jid, ...db.usuarios[jid] };
}

/**
 * Atualiza campos de um usuário existente (merge parcial).
 */
function atualizarUsuario(jid, camposParciais) {
    const db = carregar();
    if (!db.usuarios[jid]) return null;
    db.usuarios[jid] = { ...db.usuarios[jid], ...camposParciais };
    salvar(db);
    return { jid, ...db.usuarios[jid] };
}

/**
 * Lista todos os usuários cadastrados, ordenados por ID.
 */
function listarTodos() {
    const db = carregar();
    return Object.entries(db.usuarios)
        .map(([jid, dados]) => ({ jid, ...dados }))
        .sort((a, b) => a.id_rpg - b.id_rpg);
}

function existeJid(jid) {
    const db = carregar();
    return !!db.usuarios[jid];
}

export const UsuariosDB = {
    carregar,
    salvar,
    buscarPorJid,
    buscarPorId,
    buscarPorNick,
    criarUsuario,
    atualizarUsuario,
    listarTodos,
    existeJid
};
