import { CONFIG } from '../config/config.js';

const floodMap = new Map();

/**
 * Retorna true se o remetente deve ser BLOQUEADO (está em flood ou banido temporariamente).
 */
function checkFlood(sender) {
    const now = Date.now();
    const data = floodMap.get(sender);

    if (data?.banned && now < data.bannedUntil) return true;

    if (!data || now - data.start > CONFIG.flood.janelaMs) {
        floodMap.set(sender, { count: 1, start: now, banned: false, bannedUntil: 0 });
        return false;
    }

    data.count++;
    if (data.count >= CONFIG.flood.limite) {
        data.banned = true;
        data.bannedUntil = now + CONFIG.flood.banMs;
        return true;
    }
    return false;
}

export const Flood = { checkFlood };
