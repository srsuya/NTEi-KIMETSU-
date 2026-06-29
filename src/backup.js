import fs from 'fs';
import path from 'path';
import cron from 'node-cron';
import logger from '../utils/logger.js';

const DB_PATH      = './data/kimetsu.db';
const BACKUP_DIR   = './backups';
const MAX_BACKUPS  = 20;

fs.mkdirSync(BACKUP_DIR, { recursive: true });

export function iniciarBackupAutomatico() {
    // A cada 6 horas
    cron.schedule('0 */6 * * *', () => {
        realizarBackup();
    });
    logger.info('🗄️ Backup automático configurado (a cada 6 horas)');
}

export function realizarBackup() {
    try {
        if (!fs.existsSync(DB_PATH)) {
            logger.warn('Backup: banco de dados não encontrado.');
            return;
        }
        const agora = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const dest  = path.join(BACKUP_DIR, `kimetsu_${agora}.db`);
        fs.copyFileSync(DB_PATH, dest);
        logger.success(`Backup realizado: ${dest}`);

        // Remover backups antigos
        const arquivos = fs.readdirSync(BACKUP_DIR)
            .filter(f => f.endsWith('.db'))
            .map(f => ({ nome: f, mtime: fs.statSync(path.join(BACKUP_DIR, f)).mtime }))
            .sort((a, b) => b.mtime - a.mtime);

        if (arquivos.length > MAX_BACKUPS) {
            const remover = arquivos.slice(MAX_BACKUPS);
            for (const arq of remover) {
                fs.unlinkSync(path.join(BACKUP_DIR, arq.nome));
                logger.info(`Backup antigo removido: ${arq.nome}`);
            }
        }
    } catch (e) {
        logger.error(`Erro no backup: ${e.message}`);
    }
}
