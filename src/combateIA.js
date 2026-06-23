// combateIA.js - Motor de Combate Inteligente NTEi Kimetsu 4.0

// Função para processar e salvar a formatação dos 18 cards simultâneos
function extrairEGuardarCards(textoCards) {
    // Expressão regular para capturar blocos ou linhas com emojis e atributos comuns de RPG
    const linhas = textoCards.split('\n');
    let cardsValidos = [];
    
    linhas.forEach(linha => {
        if (linha.trim().length > 5) {
            cardsValidos.push(linha.trim());
        }
    });

    return JSON.stringify(cardsValidos);
}

// Lógica de simulação de combate baseado em Turnos e Estratégia de Dificuldade
function calcularMovimentoIA(cardsPlayer, nivelDificuldade) {
    let cardsIA = JSON.parse(cardsPlayer || '[]');
    if (cardsIA.length === 0) {
        cardsIA = ["⚔️ Ataque Básico [Dano: 50]", "🛡️ Defesa Padrão [Bloqueio: 40]"];
    }

    // Embaralha as ações disponíveis
    let escolha = cardsIA[Math.floor(Math.random() * cardsIA.length)];
    let modificadorDano = 1.0;
    let estrategia = "Padrão";

    switch (nivelDificuldade.toLowerCase()) {
        case 'facil':
            modificadorDano = 0.7;
            estrategia = "Defensiva passiva (Erros frequentes)";
            break;
        case 'medio':
            modificadorDano = 1.0;
            estrategia = "Equilibrada (Lê ações básicas)";
            break;
        case 'dificil':
            modificadorDano = 1.3;
            estrategia = "Agressiva (Prevê contra-ataques e foca em fraquezas)";
            break;
        case 'impossivel':
            modificadorDano = 1.8;
            estrategia = "Análise Ômega (Lê perfeitamente a sequência dos 18 cards e pune instantaneamente)";
            break;
    }

    return {
        acao: escolha,
        modificador: modificadorDano,
        estrategia: estrategia
    };
}

module.exports = { extrairEGuardarCards, calcularMovimentoIA };
