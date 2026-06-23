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
