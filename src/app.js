// ══════════════════════════════════════════════════════════════════════════
//   🍊 TANGERINA BOT RPG -(NTEi) 🍊
// ══════════════════════════════════════════════════════════════════════════

import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import Database from 'better-sqlite3';

// Inicialização do Banco de Dados SQLite (Persistência por ID)
const db = new Database('./ntei_rpg.db');

db.prepare(`
  CREATE TABLE IF NOT EXISTS jogadores (
    id_rpg INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT UNIQUE,
    nick TEXT,
    raca TEXT DEFAULT '❓ Indefinida',
    patente TEXT DEFAULT '⏺️ Cidadão',
    familia TEXT DEFAULT 'Nenhuma',
    organizacao TEXT DEFAULT 'Caçadores',
    ienes INTEGER DEFAULT 0,
    engrenagens INTEGER DEFAULT 0,
    fichas INTEGER DEFAULT 0,
    nivel_rpg INTEGER DEFAULT 1,
    xp INTEGER DEFAULT 0
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS inventarios (
    jid TEXT PRIMARY KEY,
    texto TEXT
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS configuracao_loja (
    chave TEXT PRIMARY KEY,
    conteudo TEXT
  )
`).run();

// Configurações Globais de Credenciais e Constantes
const CONFIG = {
  prefixo: '/',
  senhaAdmin: 'admin@2626',
  senhaNtei: 'ntei@3010',
  ownerJid: '5511999999999@s.whatsapp.net' // Número do Fundador/Dono
};

// Estados de Autenticação Temporária de Sessão por Chat (Controle de Senhas)
const sessoesAutenticadas = new Map(); // Guarda se o JID obteve nível 'admin' ou 'ntei'

function getNivelChat(sender) {
  if (sender === CONFIG.ownerJid) return 'ntei';
  return sessoesAutenticadas.get(sender) || 'user';
}

const fmt = (n) => Number(n).toLocaleString('pt-BR');

// Helper para capturar campos de fichas enviadas por texto
function capturarCampoFicha(linhas, termo) {
  const linha = linhas.find(l => l.toLowerCase().includes(termo.toLowerCase()));
  if (!linha) return null;
  const match = linha.match(/⌊\s*([^⌉]+)\s*⌉/);
  return match ? match[1].trim() : null;
}

// ══════════════════════════════════════════
//        PROCESSADOR DE COMANDOS CORE
// ══════════════════════════════════════════
async function gerenciarMensagem(sock, msg) {
  const jid = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
  const pushName = msg.pushName || 'Jogador';

  if (!body) return;
  const bodyLow = body.toLowerCase();

  // ─── LEITURA DE FICHA DE RECRUTAMENTO AUTOMÁTICA ───
  if (bodyLow.includes('ficha de recrutamento') || bodyLow.includes('recrutamento aprovado')) {
    const linhas = body.split('\n');
    const nick = capturarCampoFicha(linhas, 'Nick:') || pushName;
    const familia = capturarCampoFicha(linhas, 'Família:') || 'Nenhuma';
    const nacao = capturarCampoFicha(linhas, 'Nação:') || 'Aldeia do Norte';
    const recrutador = capturarCampoFicha(linhas, 'Recrutador:') || 'Sistema';

    let jogador = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    if (!jogador) {
      const stmt = db.prepare(`
        INSERT INTO jogadores (jid, nick, familia, organizacao, raca) 
        VALUES (?, ?, ?, 'Caçadores', '❓ Indefinida')
      `);
      const info = stmt.run(sender, nick, familia);
      const novoId = 1000 + info.lastInsertRowid;
      db.prepare('UPDATE jogadores SET id_rpg = ? WHERE jid = ?').run(novoId, sender);
      jogador = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
    }

    const fichaAprovada = `➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
     🤺 ᗂ ⛩️ Kimetsu New Age ⛩️ ᗃ 🤺

📃 RECRUTAMENTO APROVADO! 📃
_￫🆔◈ ID:  ⌊ ${jogador.id_rpg} ⌉_
_￫🧾◈ Nick:  ⌊ ${jogador.nick} ⌉_
_￫🧬◈ Raça:  ⌊ ${jogador.raca} ⌉_
_￫⛩️◈ Família:  ⌊ ${jogador.familia} ⌉_
_￫🏙️◈ Nação:  ⌊ ${nacao} ⌉_
_￫🔘◈ Patente:  ⌊ ${jogador.patente} ⌉_
_￫✒️◈ Recrutador:  ⌊ ${recrutador} ⌉_
➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
🍊 Bem-vindo(a) ao RPG, @${sender.split('@')[0]}!
Use */escolher raça Humano* ou */escolher raça Oni* para definir sua raça!`;

    return sock.sendMessage(jid, { text: fichaAprovada, mentions: [sender] });
  }

  // Verificação de Prefixo para comandos comuns
  if (!body.startsWith(CONFIG.prefixo)) return;
  const args = body.slice(1).trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const resto = args.slice(1);
  const nivelAtuais = getNivelChat(sender);

  // Auto-registro básico caso mande comando sem ficha
  let user = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
  if (!user && cmd !== 'menu') {
    const info = db.prepare(`INSERT INTO jogadores (jid, nick) VALUES (?, ?)`).run(sender, pushName);
    const novoId = 1000 + info.lastInsertRowid;
    db.prepare('UPDATE jogadores SET id_rpg = ? WHERE jid = ?').run(novoId, sender);
    user = db.prepare('SELECT * FROM jogadores WHERE jid = ?').get(sender);
  }

  // ─── AUTENTICAÇÕES POR SENHA ───
  if (cmd === 'admin') {
    const senhaDigitada = args[1];
    if (senhaDigitada === CONFIG.senhaAdmin) {
      sessoesAutenticadas.set(sender, 'admin');
      return sock.sendMessage(jid, { text: `✅ Painel Admin liberado para você! Digite */menuadmin*` });
    }
    return sock.sendMessage(jid, { text: `❌ Senha incorreta. Uso: */admin senha*` });
  }

  if (cmd === 'ntei') {
    const senhaDigitada = args[1];
    if (senhaDigitada === CONFIG.senhaNtei) {
      sessoesAutenticadas.set(sender, 'ntei');
      return sock.sendMessage(jid, { text: `⚛️ Modo OMEGA Ativado! Digite */menuntei*` });
    }
    return sock.sendMessage(jid, { text: `❌ Senha incorreta. Uso: */ntei senha*` });
  }

  // ─── MENUS EXECUTÁVEIS ───
  if (cmd === 'menu' || cmd === 'start') {
    const menuUser = `╭━━━〔 🍊 𝙏𝘼𝙉𝙂𝙀𝙍𝙄𝙉𝘼 𝘽𝙊𝙏 🍊 〕━━━╮
┃
┃ 👤 Usuário: ${user.nick}
┃ 🏮 Organização: ${user.organizacao}
┃ 💰 Ienes: ${user.ienes}
┃ ⚙️ Engrenagens: ${user.engrenagens}
┃ 📈 Nível: ${user.nivel_rpg}
┃
╰━━━━━━━━━━━━━━━━━━━━━╯

╭─❖「 📚 CENTRAL 」❖─╮
│ 📜 /regras-sr
│ 📜 /regras-vt
│ 📜 /regras-basicas
│ ☸️ /regras-armas
│ ♋ /marca-cacador
│ 📅 /cronograma
╰─────────────────╯

╭─❖「 ⚔️ SISTEMAS 」❖─╮
│ 💮 /elementos
│ 👥 /familias
│ 🧾 /sistema-passe
│ 🤎 /passe-bronze
│ 🩶 /passe-prata
│ 🔰 /sistema-vip
╰─────────────────╯

╭─❖「 💰 ECONOMIA 」❖─╮
│ 🪙 /tabela-ienes
│ ⚙️ /tabela-engrenagens
│ 🪙 /loja-ienes
│ ⚙️ /loja-ferreiros
│ 🕋 /tabela-rs
│ 💮 /loja-rk
╰─────────────────╯

╭─❖「 📋 FICHAS 」❖─╮
│ 🏙️ /ficha-recrutamento
│ 🪙 /transferencia
│ 📛 /ficha-pontos
│ 🏦 /compras
│ 🔩 /ferreiros
╰─────────────────╯

╭─❖「 🌎 EXTRAS 」❖─╮
│ 🌎 /extra
╰─────────────────╯

> 🍊 Tangerina Bot © 2026
> ⚡ Powered By N.T.E.I`;
    return sock.sendMessage(jid, { text: menuUser });
  }

  if (cmd === 'menuadmin') {
    if (nivelAtuais !== 'admin' && nivelAtuais !== 'ntei') return sock.sendMessage(jid, { text: `❌ Acesso negado. Use /admin [senha]` });
    const menuAdmin = `╭════════════════════════╗
│      👑 PAINEL ADMIN    │
╰════════════════════════╯

╭━━━〔 👥 USUÁRIOS 〕━━━╮
┃ 🔍 /buscar
┃ 📜 /historico
┃ ⚠️ /advertir
┃ 🚫 /ban
┃ ♻️ /desban
┃ 🔇 /mute
┃ 🔊 /unmute
┃ 🧹 /limpar-ficha
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 💰 ECONOMIA 〕━━━╮
┃ 🪙 /add-ienes
┃ 🪙 /rm-ienes
┃ ⚙️ /add-eng
┃ ⚙️ /rm-eng
┃ 🎁 /bonus
┃ 🧾 /extrato
┃ 💸 /gastos
┃ 📊 /saldo-geral
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 🏪 LOJAS 〕━━━╮
┃ ➕ /add-item
┃ ➖ /rm-item
┃ 💰 /alterar-preco
┃ 📦 /estoque
┃ 🏪 /gerenciar-loja
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 ⚔️ RPG 〕━━━╮
┃ 🎯 /criar-missao
┃ 🎲 /evento
┃ 🏆 /ranking
┃ 📈 /add-xp
┃ 📉 /rm-xp
┃ 🏮 /gerenciar-familias
╰━━━━━━━━━━━━━━━━━━╯

╭━━━〔 📊 RELATÓRIOS 〕━━━╮
┃ 📋 /logs
┃ 📈 /atividade
┃ 💰 /movimentacoes
┃ 👥 /usuarios
┃ 🚨 /denuncias
╰━━━━━━━━━━━━━━━━━━╯`;
    return sock.sendMessage(jid, { text: menuAdmin });
  }

  if (cmd === 'menuntei' || cmd === 'omega') {
    if (nivelAtuais !== 'ntei') return sock.sendMessage(jid, { text: `❌ Permissão OMEGA Requerida. Insira a chave em /ntei` });
    const menuNtei = `╭═══════════════════════════════╮
│           ☢️ N.T.E.I ☢️         │
│  NÚCLEO TECNOLÓGICO ESTRATÉGICO │
│            IMPERIAL            │
╰═══════════════════════════════╯

┌〔 🔴 ACESSO OMEGA 〕┐
│ Usuário: ${user.nick}
│ Cargo: Diretor NTEI
│ Permissão: Máxima
└───────────────────┘

╭━━━〔 💰 ECONOMIA GLOBAL 〕━━━╮
┃ 💸 /gastos
┃ 📈 /fluxocaixa
┃ 🪙 /economia-global
┃ 🏦 /banco-rpg
┃ 📊 /balanco
┃ 🧾 /transacoes
┃ 🚨 /fraudes
┃ 📋 /auditoria-financeira
┃ 🎁 /recompensas
┃ 💵 /impostos
╰━━━━━━━━━━━━━━━━━━━━━━╯

╭━━━〔 👤 JOGADORES 〕━━━╮
┃ 🔎 /perfil
┃ 📜 /historico
┃ 💰 /saldo
┃ 🎒 /inventario
┃ 📊 /estatisticas
┃ 🚫 /ban
┃ ♻️ /desban
┃ 🔇 /mute
┃ 🏅 /patentes
╰━━━━━━━━━━━━━━━━━━╯

⚠️ SISTEMA OPERACIONAL TANGERINA OS
⚠️ NÍVEL DE ACESSO: OMEGA`;
    return sock.sendMessage(jid, { text: menuNtei });
  }

  // ─── SISTEMA DE ECONOMIA POR ID E STRINGS DINÂMICAS ───
  if (cmd === 'transferir' || cmd === 'transferencia') {
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\s(\d+)/);
    const motivo = body.split(/motivo:/i)[1] || 'Negociação Livre';

    if (!matchId || !matchVal) {
      return sock.sendMessage(jid, { text: `❌ Use o padrão: */transferir id:1001 1500 motivo:Compra de Card*` });
    }

    const destId = parseInt(matchId[1]);
    const valor = parseInt(matchVal[1]);

    if (user.ienes < valor) return sock.sendMessage(jid, { text: `❌ Você não tem ${valor} Ienes suficientes.` });

    const destino = db.prepare('SELECT * FROM jogadores WHERE id_rpg = ?').get(destId);
    if (!destino) return sock.sendMessage(jid, { text: `❌ Destinatário com o ID ${destId} não existe.` });

    db.prepare('UPDATE jogadores SET ienes = ienes - ? WHERE jid = ?').run(valor, sender);
    db.prepare('UPDATE jogadores SET ienes = ienes + ? WHERE id_rpg = ?').run(valor, destId);

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const comprovante = `*➖᭄⎝ᯌ •➖• ஜ •⸨🎁⸩• ஜ •➖• ᯌ⎞➖᭄*
 *᳃🎐ᘞ Ficha De Transferência ᘞ🎐᳃*

_￫📅 ◈ Data: ⌊ ${dataAtual} ⌉_
_￫💸 ◈ Remetente: ⌊ ${user.nick} ⌉_
_￫💱 ◈ Destinatário: ⌊ ${destino.nick} ⌉_
_￫🎐 ◈ Valor: ⌊ ${valor}🪙 Ienes⌉_
_￫📄 ◈ Motivo da Transferência: ⌊ ${motivo} ⌉_

*➖᭄⎝ᯌ •➖• ஜ •⸨🎁⸩• ஜ •➖• ᯌ⎞➖᭄*
_𖠻↬✍🏻Ass:_
*⌥ˁSuperiores☯️☪️*`;
    return sock.sendMessage(jid, { text: comprovante });
  }

  if (cmd === 'rm-ienes') {
    if (nivelAtuais === 'user') return;
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\s(\d+)/);
    if (!matchId || !matchVal) return sock.sendMessage(jid, { text: `❌ Uso: */rm-ienes id:1001 500*` });

    const targetId = parseInt(matchId[1]);
    const valor = parseInt(matchVal[1]);
    db.prepare('UPDATE jogadores SET ienes = MAX(0, ienes - ?) WHERE id_rpg = ?').run(valor, targetId);
    return sock.sendMessage(jid, { text: `✅ Removido o valor do ID ${targetId} com sucesso.` });
  }

  if (cmd === 'add-ienes') {
    if (nivelAtuais === 'user') return;
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\s(\d+)/);
    if (!matchId || !matchVal) return sock.sendMessage(jid, { text: `❌ Uso: */add-ienes id:1001 500*` });

    const targetId = parseInt(matchId[1]);
    const valor = parseInt(matchVal[1]);
    db.prepare('UPDATE jogadores SET ienes = ienes + ? WHERE id_rpg = ?').run(valor, targetId);
    return sock.sendMessage(jid, { text: `🪙 Adicionado com sucesso ao ID ${targetId}.` });
  }

  if (cmd === 'addtabela') {
    if (nivelAtuais === 'user') return;
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\+(\d+)/);
    if (!matchId || !matchVal) return;

    const targetId = parseInt(matchId[1]);
    const valor = parseInt(matchVal[1]);
    db.prepare('UPDATE jogadores SET ienes = ienes + ? WHERE id_rpg = ?').run(valor, targetId);
    return sock.sendMessage(jid, { text: `📊 Tabela Modificada! ID ${targetId} recebeu +${valor}` });
  }

  if (cmd === 'tabela-ienes') {
    const list = db.prepare('SELECT nick, ienes, raca FROM jogadores').all();
    let humanos = '', onis = '', total = 0;

    list.forEach(p => {
      total += p.ienes;
      if (p.raca.toLowerCase().includes('oni')) {
        onis += `_⟆👹⟅ ${p.nick}「${fmt(p.ienes)}🪙Ienes」_\n`;
      } else {
        humanos += `_⟆👱🏻‍♂️⟅ ${p.nick}「${fmt(p.ienes)}🪙Ienes」_\n`;
      }
    });

    const outputTabela = `*႟ •➖ ᯘ• 🏦 •භ ⸨ 🪙 ⸩ භ• 🏦 •ᯘ ➖• ႟*
  *˖𓍢ִ໋✨✧˚🏙️༘˚Aldeia do Norte˚༘🏙️˚✧✨֒˖𓍢ִ໋*
       _◈ᗂ 🪙ᡉ Tabela de Ienesᡉ🪙ᗃ◈_

        *႟ •➖ ᯘ • භ ⸨ 🪙 ⸩ භ • ᯘ ➖• ႟*
                    _ৈ👱🏻‍♂️ᑐ "Humanos"_

${humanos || '_Nenhum humano registrado_\n'}
        *႟ •➖ ᯘ • භ ⸨ 🪙 ⸩ භ • ᯘ ➖• ႟*
                    _ৈ👹ᑐ "Onis"_

${onis || '_Nenhum oni registrado_\n'}
       *႟ •➖ ᯘ • භ ⸨ 🪙 ⸩ භ • ᯘ ➖•s ႟*

*_୧❕Ienes da Aldeia_*
_⟆🏙️⟅ Aldeia do Norte「${fmt(total)} Ienes」_

*_୧🤵🏻Atualizado Por: Central Automática NTEi_*
*_୧📅Data da atualização: ${new Date().toLocaleDateString('pt-BR')}_*
*႟ •➖ ᯘ• 🏦 •භ ⸨ 🪙 ⸩ භ• 🏦 •ᯘ ➖• ႟*`;
    return sock.sendMessage(jid, { text: outputTabela });
  }

  // ─── COMANDO ALTERAÇÃO DE PATENTES ───
  if (cmd === 'patentes' || cmd === 'setpatente') {
    if (nivelAtuais === 'user') return sock.sendMessage(jid, { text: `❌ Comando para Moderadores.` });
    const matchId = body.match(/id:(\d+)/i);
    const novaPatente = body.replace(/\/setpatente|\/patentes/i, '').replace(/id:\d+/i, '').trim();
    if (!matchId || !novaPatente) return sock.sendMessage(jid, { text: `❌ Uso: */setpatente id:1001 Hashira da Névoa*` });

    db.prepare('UPDATE jogadores SET patente = ? WHERE id_rpg = ?').run(novaPatente, parseInt(matchId[1]));
    return sock.sendMessage(jid, { text: `⚔️ Patente do ID ${matchId[1]} foi alterada para: *${novaPatente}*` });
  }

  // ─── CONSULTA DE IDS EM LISTA GERAL ───
  if (cmd === 'buscar' || cmd === 'usuarios' || cmd === 'listaids') {
    const todos = db.prepare('SELECT id_rpg, nick, patente FROM jogadores').all();
    let strIds = `📋 *TABELA DE IDS - CONSULTA GERAL*\n\n`;
    todos.forEach(p => {
      strIds += `Id:${p.id_rpg} | ${p.nick} [${p.patente || 'Membro'}]\n`;
    });
    return sock.sendMessage(jid, { text: strIds });
  }

  // ─── INVENTÁRIO INDIVIDUAL DE CARDS ───
  if (bodyLow.startsWith('/salvar inventário') || bodyLow.startsWith('/salvarinventario')) {
    const textoCards = body.substring(body.indexOf(' ')).trim();
    if (!textoCards) return sock.sendMessage(jid, { text: `❌ Digite o texto dos seus cards junto com o comando.` });
    db.prepare('INSERT OR REPLACE INTO inventarios (jid, texto) VALUES (?, ?)').run(sender, textoCards);
    return sock.sendMessage(jid, { text: `🎒 Seu controle de cards foi atualizado e salvo com sucesso!` });
  }

  if (cmd === 'inventario' || cmd === 'inventário') {
    const inv = db.prepare('SELECT texto FROM inventarios WHERE jid = ?').get(sender);
    if (!inv) return sock.sendMessage(jid, { text: `❌ Você não salvou cards ainda. Use /Salvar Inventário + Conteúdo` });
    return sock.sendMessage(jid, { text: `🎒 *SEU CONTROLE DE CARDS SAVO:*\n\n${inv.texto}` });
  }

  // ─── DEFINIÇÃO DE RAÇA E FAMÍLIA PELO USUÁRIO ───
  if (cmd === 'escolher') {
    const tipo = args[1]?.toLowerCase();
    const escolha = resto.slice(1).join(' ');

    if (tipo === 'raça' || tipo === 'raca') {
      if (escolha.toLowerCase() === 'humano' || escolha.toLowerCase() === 'oni') {
        db.prepare('UPDATE jogadores SET raca = ? WHERE jid = ?').run(escolha, sender);
        return sock.sendMessage(jid, { text: `🧬 Raça definida para *${escolha}* com sucesso!` });
      }
      return sock.sendMessage(jid, { text: `❌ Escolha válida: */escolher raça Humano* ou */escolher raça Oni*` });
    }

    if (tipo === 'família' || tipo === 'familia') {
      db.prepare('UPDATE jogadores SET familia = ? WHERE jid = ?').run(escolha, sender);
      return sock.sendMessage(jid, { text: `⛩️ Sua família agora é *${escolha}*!` });
    }
  }

  // ─── CONSULTA DE FAMÍLIAS DISPONÍVEIS ───
  if (cmd === 'familias' || cmd === 'famílias') {
    const menuFamilias = `*➖᭄⎝ᯌ •➖• ஜ •⸨🌅⸩• ஜ •➖• ᯌ⎞➖᭄*
         _ᗂ ⛩️ Famílias Disponíveis ⛩️ ᗃ_

ᗂ🌅• Vila dos Ferreiros •🌅ᗃ
> Família Kanroji    ⃝💟
- Regenera 70%❤️ da vida do usuário.
> Família Tokito    ⃝♌
- Drena 10%🔹 de energia do oponente.

ᗂ🏙️• Vila dos Ferreiros •🏙️ᗃ
> Família Tomioka    ⃝☸️
- Aumenta 50%❤️/🔹 de vida e energia total do usuário.
> Família Kamado    ⃝🎴
- Aumenta 30%♦️ de dano em técnicas do usuário.

*➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄*`;
    return sock.sendMessage(jid, { text: menuFamilias });
  }

  // ─── SINALIZADOR PLACAR DE LUTAS AUTOMÁTICO por ID ───
  if (cmd === 'plc' || cmd === 'placar') {
    const id1 = parseInt(args[1]);
    const id2 = parseInt(args[2]);
    if (!id1 || !id2) return sock.sendMessage(jid, { text: `❌ Use: */plc ID_Player1 ID_Player2*` });

    const p1 = db.prepare('SELECT nick, familia, patente FROM jogadores WHERE id_rpg = ?').get(id1);
    const p2 = db.prepare('SELECT nick, familia, patente FROM jogadores WHERE id_rpg = ?').get(id2);

    if (!p1 || !p2) return sock.sendMessage(jid, { text: `❌ Um ou ambos os IDs informados não constam no banco.` });

    const dataPlc = new Date().toLocaleDateString('pt-BR');
    const templatePlc = `*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*
    _ಶ 🔆 ၍ Kimetsu New Age ၍ 🔆 ಶ_
       *႟⚔️୨ Placar De Lutas୧🛡️႟*
           *⊢📆〣${dataPlc}〣📆⊣*

*၍👤ID: ${id1} | ${p1.nick}/${p1.familia}/${p1.patente}*
*❣️200/400⚡*
VS
*၍👤ID: ${id2} | ${p2.nick}/${p2.familia}/${p2.patente}*
*❣️200/400⚡*

*ᥫ •➖• ᯏ ➖•᯾• ⟆⚔️⟅ •᯾•➖ ᯟ •➖•ᥫ*
_𖠻↬✍🏻Ass:_
*⌥ʕBy NTEi🛜ʔ⌥*`;
    return sock.sendMessage(jid, { text: templatePlc });
  }

  // ─── RECONHECIMENTO E SALVAMENTO DE LOJA CUSTOMIZADA ───
  if (bodyLow.includes('loja de fichas') && (nivelAtuais === 'admin' || nivelAtuais === 'ntei')) {
    db.prepare(`INSERT OR REPLACE INTO configuracao_loja (chave, conteudo) VALUES ('loja_fichas', ?)`).run(body);
    return sock.sendMessage(jid, { text: `🏪 Molde de Loja registrado e atualizado para consultas no comando /loja-rk!` });
  }

  if (cmd === 'loja-rk') {
    const dadosLoja = db.prepare(`SELECT conteudo FROM configuracao_loja WHERE chave = 'loja_fichas'`).get();
    if (!dadosLoja) return sock.sendMessage(jid, { text: `🏪 Nenhuma loja customizada foi enviada pela staff ainda.` });
    return sock.sendMessage(jid, { text: dadosLoja.conteudo });
  }
}

// ══════════════════════════════════════════
//    CONEXÃO COMPATÍVEL COM BAILEYS V6
// ══════════════════════════════════════════
async function conectarNtei() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.ubuntu('Chrome')
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const rec = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (rec) conectarNtei();
    } else if (connection === 'open') {
      console.log('🍊 Tangerina OS & Core NTEi carregados com Sucesso!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      try {
        await gerenciarMensagem(sock, msg);
      } catch (err) {
        console.error('NTEi Error Handler:', err);
      }
    }
  });
}

conectarNtei();
