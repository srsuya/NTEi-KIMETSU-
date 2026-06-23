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
