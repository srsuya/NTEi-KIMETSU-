import { CONFIG, OWNER_JID } from '../config/config.js';

// Sessões temporárias em memória: jid -> timestamp de expiração
const sessoesAdmin = new Map();
const sessoesNtei = new Map();

function limparExpiradas(mapa) {
    const agora = Date.now();
    for (const [jid, expira] of mapa.entries()) {
        if (expira < agora) mapa.delete(jid);
    }
}

function isDono(jid) {
    return jid === OWNER_JID;
}

function abrirSessaoAdmin(jid) {
    sessoesAdmin.set(jid, Date.now() + CONFIG.sessaoDuracaoMs);
}

function abrirSessaoNtei(jid) {
    sessoesNtei.set(jid, Date.now() + CONFIG.sessaoDuracaoMs);
}

function temSessaoAdmin(jid) {
    limparExpiradas(sessoesAdmin);
    return isDono(jid) || (sessoesAdmin.has(jid) && sessoesAdmin.get(jid) > Date.now());
}

function temSessaoNtei(jid) {
    limparExpiradas(sessoesNtei);
    return isDono(jid) || (sessoesNtei.has(jid) && sessoesNtei.get(jid) > Date.now());
}

/**
 * Retorna o nível de acesso mais alto que o jid possui: 'ntei' | 'admin' | 'user'
 */
function nivelDeAcesso(jid) {
    if (temSessaoNtei(jid)) return 'ntei';
    if (temSessaoAdmin(jid)) return 'admin';
    return 'user';
}

export const Auth = {
    isDono,
    abrirSessaoAdmin,
    abrirSessaoNtei,
    temSessaoAdmin,
    temSessaoNtei,
    nivelDeAcesso
};
