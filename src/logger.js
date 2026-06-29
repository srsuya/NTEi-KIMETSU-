import fs from 'fs';
import path from 'path';

const LOG_DIR = './logs';
fs.mkdirSync(LOG_DIR, { recursive: true });

function timestamp() {
    return new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function writeToFile(level, msg) {
    const date = new Date().toISOString().slice(0, 10);
    const line = `[${timestamp()}] [${level}] ${msg}\n`;
    fs.appendFileSync(path.join(LOG_DIR, `${date}.log`), line);
}

const logger = {
    info:  (msg) => { console.log(`\x1b[36m[INFO]\x1b[0m ${msg}`);  writeToFile('INFO', msg); },
    warn:  (msg) => { console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`); writeToFile('WARN', msg); },
    error: (msg) => { console.error(`\x1b[31m[ERR]\x1b[0m ${msg}`);  writeToFile('ERROR', msg); },
    debug: (msg) => { if (process.env.DEBUG) console.log(`\x1b[90m[DBG]\x1b[0m ${msg}`); },
    success:(msg) => { console.log(`\x1b[32m[OK]\x1b[0m ${msg}`);   writeToFile('OK', msg); },
};

export default logger;
