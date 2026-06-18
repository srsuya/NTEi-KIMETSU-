import db from '../database/connection.js';

export async function authMiddleware(sock, msg, remoteJid, sender) {
    const ownerJid = process.env.OWNER_JID || '5511999999999@s.whatsapp.net'; // Altere no seu .env depois
    
    // 1. É o Dono do Bot (Owner)?
    const isOwner = sender === ownerJid;

    // 2. É Administrador do Grupo?
    let isAdminGroup = false;
    if (remoteJid.endsWith('@g.us')) {
        try {
            const groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants;
            const user = participants.find(p => p.id === sender);
            isAdminGroup = user && (user.admin === 'admin' || user.admin === 'superadmin');
        } catch (e) {
            console.error("Erro ao buscar metadados do grupo:", e);
        }
    }

    return {
        isOwner,
        isAdminGroup,
        isAllowedAdminCmd: isOwner || isAdminGroup
    };
}
