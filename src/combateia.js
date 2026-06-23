bash
cd /home/claude/repo && echo "=== combateia.js ===" && cat src/combateia.js && echo "=== admin/adminCmds.js ===" && cat src/commands/admin/adminCmds.js && echo "=== rpg/familia.js ===" && cat src/commands/rpg/familia.js
=== combateia.js ===
// combateIA.js - Motor de Batalha e Inteligência Tática para Banco de Dados JSON
const fs = require('fs');
/**
 * Filtra e organiza as linhas de cards enviados pelo usuário
 */
function processarEGuardarCards(textoCards) {
    if (!textoCards) return "";
    const linhas = textoCards.split('\n');
    let cardsValidos = [];
    
    linhas.forEach(linha => {
        if (linha.trim().length > 0) {
            cardsValidos.push(linha.trim());
        }
    });
    return cardsValidos.join('\n');
}

/**
 * IA que gera estratégias e simula movimentos com base no inventário textual de cards
 */
function calcularMovimentoIA(cardsTexto, dificuldade) {
    let cardsDisponiveis = [];
    if (cardsTexto && cardsTexto.trim().length > 0) {
        cardsDisponiveis = cardsTexto.split('\n');
    }

    // Ataques padrão caso o jogador não tenha ensinado nada ao bot ainda
    if (cardsDisponiveis.length === 0) {
        cardsDisponiveis = [
            "⚔️ [ATAQUE] Corte Rápido Focado - Dano: 120",
            "🛡️ [DEFESA] Postura de Bloqueio Absoluto - Absorção: 100",
            "💨 [ESQUIVA] Movimento Lateral Fluido"
        ];
    }

    let cardEscolhido = cardsDisponiveis[Math.floor(Math.random() * cardsDisponiveis.length)];
    let estrategia = "Equilibrada";

    switch (dificuldade.toLowerCase()) {
        case 'facil':
            estrategia = "Defensiva Simples (Comete erros propositais)";
            break;
        case 'medio':
            estrategia = "Análise Adaptativa Básica (Lê padrões comuns)";
            break;
        case 'dificil':
            estrategia = "Contra-Ataque Avançado (Punição severa)";
            break;
        case 'impossivel':
            estrategia = "🔮 CONSCIÊNCIA ÔMEGA (Antecipa os 18 cards e aplica combo fatal)";
            break;
    }

    return {
        card: cardEscolhido,
        estrategia: estrategia
    };
}

module.exports = { processarEGuardarCards, calcularMovimentoIA };
=== admin/adminCmds.js ===
import db from '../../database/connection.js';
import { EconomyService } from '../../services/economy.js';

export async function commandAdminManager(sock, remoteJid, text) {
    const args = text.split(' ');
    const comando = args[0].toLowerCase();

    // /addienes @marcar valor OU /addienes 1001 valor
    if (comando === '/addienes' || comando === '/addfichas') {
        const target = args[1];
        const valor = parseInt(args[2]);
        const moeda = comando === '/addienes' ? 'IENES' : 'FICHAS';

        if (!target || isNaN(valor)) {
            await sock.sendMessage(remoteJid, { text: `❌ Uso: ${comando} [ID_RPG ou @marcar] [valor]` });
            return;
        }

        let queryUser;
        if (target.includes('@')) {
            const jidClean = target.replace('@', '') + '@s.whatsapp.net';
            queryUser = db.prepare('SELECT jid, nick FROM jogadores WHERE jid = ?').get(jidClean);
        } else {
            queryUser = db.prepare('SELECT jid, nick FROM jogadores WHERE id_rpg = ?').get(target);
        }

        if (!queryUser) {
            await sock.sendMessage(remoteJid, { text: '❌ Jogador não localizado no banco de dados.' });
            return;
        }

        const res = EconomyService.alterarSaldo(queryUser.jid, moeda, valor, 'ADD', 'Adicionado pelo Administrador');
        if (res.success) {
            await sock.sendMessage(remoteJid, { text: `✅ Sucesso! Adicionado ${valor} ${moeda === 'IENES' ? '💰' : '🎐'} para *${queryUser.nick}*.` });
        }
    }

    // /setpatente [ID_RPG] [Nome da Patente]
    if (comando === '/setpatente') {
        const idRpg = args[1];
        const novaPatente = args.slice(2).join(' ');

        if (!idRpg || !novaPatente) {
            await sock.sendMessage(remoteJid, { text: '❌ Uso: /setpatente [ID_RPG] [Nome da Patente]' });
            return;
        }

        const alterado = db.prepare('UPDATE jogadores SET patente = ? WHERE id_rpg = ?').run(novaPatente, idRpg);
        if (alterado.changes > 0) {
            await sock.sendMessage(remoteJid, { text: `✅ Patente atualizada com sucesso para o ID #${idRpg}.` });
        } else {
            await sock.sendMessage(remoteJid, { text: '❌ ID não encontrado.' });
        }
    }
}
=== rpg/familia.js ===
export const FAMILIAS = {
    'kanroji': {
        nome: 'Kanroji',
        emoji: '💟',
        vila: 'Vila dos Ferreiros',
        descricao: 'Regenera 70%❤️ da vida do usuário.'
    },
    'tokito': {
        nome: 'Tokito',
        emoji: '♌',
        vila: 'Vila dos Ferreiros',
        descricao: 'Drena 10%🔹 de energia do oponente.'
    },
    'tomioka': {
        nome: 'Tomioka',
        emoji: '☸️',
        vila: 'Vila dos Ferreiros',
        descricao: 'Aumenta 50%❤️/🔹 de vida e energia total do usuário.'
    },
    'kamado': {
        nome: 'Kamado',
        emoji: '🎴',
        vila: 'Vila dos Ferreiros',
        descricao: 'Aumenta 30%♦️ de dano em técnicas do usuário.'
    }
};

export function listarFamiliasTexto() {
    return `*➖᭄⎝ᯌ •➖• ஜ •⸨🌅⸩• ஜ •➖• ᯌ⎞➖᭄*
         _ᗂ ⛩️ Famílias Disponíveis ⛩️ ᗃ_

ᗂ🌅• Vila dos Ferreiros •🌅ᗃ
> Família Kanroji    ⃝💟
- ${FAMILIAS.kanroji.descricao}
> Família Tokito    ⃝♌
- ${FAMILIAS.tokito.descricao}

ᗂ🏙️• Vila dos Ferreiros •🏙️ᗃ
> Família Tomioka    ⃝☸️
- ${FAMILIAS.tomioka.descricao}
> Família Kamado    ⃝🎴
- ${FAMILIAS.kamado.descricao}

*➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄*`;
}

export function buscarFamilia(nomeOuChave) {
    if (!nomeOuChave) return null;
    const chave = nomeOuChave.toLowerCase().trim();
    if (FAMILIAS[chave]) return FAMILIAS[chave];
    return Object.values(FAMILIAS).find(f => f.nome.toLowerCase() === chave) || null;
}
