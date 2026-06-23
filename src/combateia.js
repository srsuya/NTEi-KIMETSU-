// combateIA.js - Motor de Batalha e Inteligência Tática Ômega
const fs = require('fs');

/**
 * Filtra e guarda perfeitamente o bloco com os 18 cards enviados
 */
function processarEGuardarCards(textoCards) {
    if (!textoCards) return "[]";
    const linhas = textoCards.split('\n');
    let cardsValidos = [];
    
    linhas.forEach(linha => {
        if (linha.trim().length > 0) {
            cardsValidos.push(linha.trim());
        }
    });
    return JSON.stringify(cardsValidos);
}

/**
 * IA que gera estratégias e executa movimentos com base nos cards salvos e na dificuldade
 */
function calcularMovimentoIA(cardsJogadorJSON, dificuldade) {
    let cardsDisponiveis = [];
    try {
        cardsDisponiveis = JSON.parse(cardsJogadorJSON || '[]');
    } catch (e) {
        cardsDisponiveis = [];
    }

    // Ataques padrão caso o jogador ainda não tenha ensinado nada ao bot
    if (cardsDisponiveis.length === 0) {
        cardsDisponiveis = [
            "⚔️ [ATAQUE] Corte Rápido Focado - Dano: 120",
            "🛡️ [DEFESA] Postura de Bloqueio Absoluto - Absorção: 100",
            "💨 [ESQUIVA] Movimento Lateral Fluido - Stamina: -20"
        ];
    }

    // O bot seleciona um card simulando consciência tática
    let cardEscolhido = cardsDisponiveis[Math.floor(Math.random() * cardsDisponiveis.length)];
    let estrategia = "Equilibrada";
    let multiplicadorDano = 1.0;

    switch (dificuldade.toLowerCase()) {
        case 'facil':
            multiplicadorDano = 0.7;
            estrategia = "Defensiva Simples (Comete erros propositais)";
            break;
        case 'medio':
            multiplicadorDano = 1.0;
            estrategia = "Análise Adaptativa Básica (Lê padrões comuns)";
            break;
        case 'dificil':
            multiplicadorDano = 1.4;
            estrategia = "Contra-Ataque Avançado (Punição severa)";
            break;
        case 'impossivel':
            multiplicadorDano = 2.5;
            estrategia = "🔮 CONSCIÊNCIA ÔMEGA (Antecipa os 18 cards e pune com combo fatal)";
            break;
    }

    return {
        card: cardEscolhido,
        estrategia: estrategia,
        multiplicador: multiplicadorDano
    };
}

module.exports = { processarEGuardarCards, calcularMovimentoIA };
