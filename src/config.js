// src/config/config.js
// Configurações globais do bot. Ajuste OWNER_NUMBER antes de subir em produção.

export const CONFIG = {
    ownerNumber: '5511974386284', // Troque pelo número do dono, sem @ e sem +
    senhaAdmin: 'admin@2626',
    senhaNtei: 'ntei@3010',
    prefixo: '!',
    sessaoDuracaoMs: 60 * 60 * 1000, // 1 hora
    floodLimite: 5,
    floodJanelaMs: 5000,
    floodBanMs: 5 * 60 * 1000,
    backupIntervaloMs: 6 * 60 * 60 * 1000, // 6 horas
    idInicial: 1000
};

export const OWNER_JID = `${CONFIG.ownerNumber}@s.whatsapp.net`;
