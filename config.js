// ══════════════════════════════════════════
//           CONFIGURAÇÕES GLOBAIS
// ══════════════════════════════════════════
// Edite os valores abaixo antes de subir o bot.

export const CONFIG = {
    // Número do DONO do bot, SEM o "+" e SEM o "@s.whatsapp.net"
    // Exemplo: 5511999999999
    ownerNumber: '5511999999999',

    // Senhas de acesso aos painéis (troque antes de usar em produção)
    senhaAdmin: 'admin@2626',
    senhaNtei: 'ntei@3010',

    // Duração da sessão de admin/ntei depois de logar com a senha (em ms)
    sessaoDuracaoMs: 60 * 60 * 1000, // 1 hora

    // Caminhos dos arquivos de banco de dados (JSON)
    paths: {
        usuarios: './database/usuarios.json',
        aldeia: './database/aldeia.json',
        logs: './database/logs.json',
        loja: './database/loja.json',
        inventarios: './database/inventarios.json',
        placares: './database/placares.json',
        cards: './database/cards.json',
        transacoes: './database/transacoes.json'
    },

    // Anti-flood
    flood: {
        limite: 5,            // mensagens
        janelaMs: 5000,       // dentro de quantos ms
        banMs: 5 * 60 * 1000  // tempo de bloqueio quando estoura o limite
    },

    // Valores padrão de um novo jogador
    novoJogador: {
        ienes: 0,
        fichas: 0,
        eng: 0,
        xp: 0,
        nivel: 1,
        hpMax: 400,
        energiaMax: 100,
        raca: 'Indefinida',
        familia: 'Nenhuma',
        nacao: 'Aldeia do Norte',
        patente: '⏺️ Cidadão',
        recrutador: 'Sistema'
    },

    // Patentes disponíveis, em ordem (usadas para validar /alterar-patente)
    patentes:[
    {
        "categoria": "Humano 👱🏻‍♂️🎭",
        "patentes": [
            {"emoji": "⏺️", "patente": "Cidadão"},
            {"emoji": "🈸", "patente": "Aprendiz"},
            {"emoji": "🈳", "patente": "Mizunoto"},
            {"emoji": "✳️", "patente": "Kanoto"},
            {"emoji": "🔘", "patente": "Hashira"}
        ]
    },
    {
        "categoria": "Oni 👹😈",
        "patentes": [
            {"emoji": "⏺️", "patente": "Cidadão"},
            {"emoji": "🈵", "patente": "Mutante"},
            {"emoji": "🔯", "patente": "Oni Inferior"},
            {"emoji": "🛑", "patente": "Lua Inferior"},
            {"emoji": "☪️", "patente": "Lua Superior"}
        ]
    },
    {
        "categoria": "Sup 🎴",
        "patentes": [
            {"emoji": "🀄", "patente": "Ambos (👱🏻‍♂️/👹)"},
            {"emoji": "🔅", "patente": "Conselheiro"},
            {"emoji": "♠️", "patente": "Imperador"},
            {"emoji": "⚜️", "patente": "Shogun"},
            {"emoji": "🃏", "patente": "Daimyo"}
        ]
    }
]
};

export const OWNER_JID = `${CONFIG.ownerNumber}@s.whatsapp.net`;
