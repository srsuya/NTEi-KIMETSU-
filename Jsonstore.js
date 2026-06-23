import fs from 'fs';
import path from 'path';

/**
 * Lê um arquivo JSON. Se não existir, cria com o valor inicial informado.
 */
export function lerJSON(caminho, valorInicial) {
    const dir = path.dirname(caminho);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(caminho)) {
        fs.writeFileSync(caminho, JSON.stringify(valorInicial, null, 2));
        return JSON.parse(JSON.stringify(valorInicial));
    }
    try {
        const conteudo = fs.readFileSync(caminho, 'utf-8');
        return JSON.parse(conteudo);
    } catch (err) {
        console.error(`[DB] Erro ao ler ${caminho}, recriando com valor inicial.`, err);
        fs.writeFileSync(caminho, JSON.stringify(valorInicial, null, 2));
        return JSON.parse(JSON.stringify(valorInicial));
    }
}

/**
 * Escreve um objeto em JSON no caminho informado.
 */
export function salvarJSON(caminho, dados) {
    const dir = path.dirname(caminho);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(caminho, JSON.stringify(dados, null, 2));
}

/**
 * Formata um número com separador de milhar no padrão brasileiro (333.830).
 */
export function formatarNumero(valor) {
    return Number(valor || 0).toLocaleString('pt-BR');
}

/**
 * Formata data atual no padrão dd/mm/aaaa.
 */
export function dataAtual() {
    const d = new Date();
    const dia = String(d.getDate()).padStart(2, '0');
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const ano = d.getFullYear();
    return `${dia}/${mes}/${ano}`;
}

/**
 * Formata hora atual no padrão hh:mm.
 */
export function horaAtual() {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
}
