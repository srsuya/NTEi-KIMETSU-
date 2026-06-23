// src/config/settings.js
// Tabelas de configuração de raças, patentes, famílias e nações/vilas.

export const RACES = {
    HUMAN: 'Humano',
    ONI: 'Oni'
};

export const RANKS = {
    [RACES.HUMAN]: [
        '⏺️ Cidadão',
        '🈸 Aprendiz',
        '🈳 Mizunoto',
        '✳️ Kanoto',
        '🔘 Hashira'
    ],
    [RACES.ONI]: [
        '⏺️ Cidadão',
        '🈵 Mutante',
        '🔯 Oni Inferior',
        '🛑 Lua Inferior',
        '☪️ Lua Superior'
    ],
    SPECIAL: [
        '🀄 Ambos',
        '🔅 Conselheiro',
        '♠️ Imperador',
        '⚜️ Shogun',
        '🃏 Daimyo'
    ]
};

export const FAMILIES = ['Tokito', 'Kanroji', 'Tomioka', 'Kamado'];
export const VILLAGES = ['Vila dos Ferreiros', 'Aldeia do Norte'];

// Tabela de sorteio de habilidades (mantida do app.js original)
export const TABELA_SORTEIO = {
    secreta: { chance: 1, itens: ['👑 Kekkijutsu do Rei', '🦊 Kekkijutsu da Kitsune', '🪽 Respiração Angelical', '🌑 Respiração do Eclipse'] },
    lendaria: { chance: 6, itens: ['🧭 Kekkijutsu da Morte Destrutiva', '❄️ Kekkijutsu do Gelo', '🌙 Respiração da Lua', '🔘 Kekkijutsu Ondas de Choque', '🔆 Respiração do Sol', '🪨 Respiração da Pedra', '💀 Respiração da Morte', '🐲 Respiração do Dragão'] },
    mitica: { chance: 18, itens: ['🌊 Respiração da Água (Tomioka)', '🌫️ Respiração da Névoa', '🌀 Respiração da Fera', '❄️ Respiração da Neve', '🌅 Respiração da Aurora', '🩸 Respiração do Sangue', '💫 Kekkijutsu da Emoção', '🐠 Kekkijutsu dos Peixes', '🩸 Kekkijutsu do Sangue Venenoso', '💥 Kekkijutsu do Sangue Explosivo', '⚡ Kekkijutsu do Raio Negro', '🔯 Kekkijutsu das Memórias'] },
    epica: { chance: 30, itens: ['🌪️ Respiração do Vento', '🔥 Respiração das Chamas', '🐍 Respiração da Serpente', '🔊 Respiração do Som', '💞 Respiração do Amor', '🌟 Respiração da Estrela', '🌹 Respiração da Rosa', '🌑 Respiração da Escuridão', '💤 Kekkijutsu dos Sonhos', '🕷️ Kekkijutsu das Aranhas', '👁️‍🗨️ Kekkijutsu das Sombras', '🎀 Kekkijutsu das Faixas Obi', '🎻 Kekkijutsu da Biwa', '🗡️ Kekkijutsu dos Cortes', '🪞 Kekkijutsu dos Espelhos', '🧸 Kekkijutsu das Marionetes'] },
    rara: { chance: 45, itens: ['💧 Respiração da Água', '⚡ Respiração do Trovão', '🦋 Respiração do Inseto', '🌸 Respiração da Flor', '🕸️ Respiração da Teia', '🪶 Respiração do Pássaros', '🌱 Respiração do Broto', '🌸 Kekkijutsu da Flor', '⚽ Kekkijutsu da Temari', '🔁 Kekkijutsu da Seta', '🪘 Kekkijutsu do Tambor', '🐍 Kekkijutsu da Cobra', '🎐 Kekkijutsu do Papel', '🧿 Kekkijutsu do Olho'] }
};
