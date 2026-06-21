// ══════════════════════════════════════════════════════════════════════════
//   🍊 TANGERINA BOT RPG -  (NTEi) 🍊
// ══════════════════════════════════════════════════════════════════════════

import makeWASocket, { useMultiFileAuthState, DisconnectReason, Browsers } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';

// Caminhos dos arquivos de banco de dados JSON
const DB_PATH = './ntei_rpg.json';
const LOJA_PATH = './loja_config.json';

// Inicialização e Carga dos Bancos JSON de forma segura
function carregarDB() {
  if (!fs.existsSync(DB_PATH)) {
    const inicial = { proximoId: 1003, jogadores: {}, inventarios: {} };
    fs.writeFileSync(DB_PATH, JSON.stringify(inicial, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function salvarDB(dados) {
  fs.writeFileSync(DB_PATH, JSON.stringify(dados, null, 2));
}

function carregarLoja() {
  if (!fs.existsSync(LOJA_PATH)) {
    const inicial = { loja_fichas: "" };
    fs.writeFileSync(LOJA_PATH, JSON.stringify(inicial, null, 2));
  }
  return JSON.parse(fs.readFileSync(LOJA_PATH, 'utf-8'));
}

function salvarLoja(dados) {
  fs.writeFileSync(LOJA_PATH, JSON.stringify(dados, null, 2));
}

// Configurações Globais de Credenciais e Constantes
const CONFIG = {
  prefixo: '/',
  senhaAdmin: 'admin@2626',
  senhaNtei: 'ntei@3010',
  ownerJid: '5511999999999@s.whatsapp.net'
};

const sessoesAutenticadas = new Map();

function getNivelChat(sender) {
  if (sender === CONFIG.ownerJid) return 'ntei';
  return sessoesAutenticadas.get(sender) || 'user';
}

const fmt = (n) => Number(n).toLocaleString('pt-BR');

function capturarCampoFicha(linhas, termo) {
  const linha = linhas.find(l => l.toLowerCase().includes(termo.toLowerCase()));
  if (!linha) return null;
  const match = linha.match(/⌊\s*([^⌉]+)\s*⌉/);
  return match ? match[1].trim() : null;
}

// Encontra ou cria perfil de jogador baseado no JID
function obterOuCriarJogador(jid, nomePadrao) {
  const db = carregarDB();
  if (!db.jogadores[jid]) {
    const novoId = db.proximoId;
    db.proximoId += 1;
    db.jogadores[jid] = {
      id_rpg: novoId,
      jid: jid,
      nick: nomePadrao,
      raca: '❓ Indefinida',
      patente: '⏺️ Cidadão',
      familia: 'Nenhuma',
      organizacao: 'Caçadores',
      ienes: 0,
      engrenagens: 0,
      nivel_rpg: 1
    };
    salvarDB(db);
  }
  return db.jogadores[jid];
}

// Atualiza dados de um jogador específico
function atualizarJogador(jid, dadosAtualizados) {
  const db = carregarDB();
  db.jogadores[jid] = { ...db.jogadores[jid], ...dadosAtualizados };
  salvarDB(db);
}

// Busca jogador por ID Numérico do RPG
function buscarJogadorPorId(idNum) {
  const db = carregarDB();
  return Object.values(db.jogadores).find(p => p.id_rpg === parseInt(idNum));
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

    let jogador = obterOuCriarJogador(sender, nick);
    jogador.nick = nick;
    jogador.familia = familia;
    atualizarJogador(sender, jogador);

    const fichaAprovada = ` Bradley ➖᭄⎝ᯌ •➖• ஜ •⸨🏙️⸩• ஜ •➖• ᯌ⎞➖᭄
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

  if (!body.startsWith(CONFIG.prefixo)) return;
  const args = body.slice(1).trim().split(/\s+/);
  const cmd = args[0].toLowerCase();
  const resto = args.slice(1);
  const nivelAtuais = getNivelChat(sender);

  let user = obterOuCriarJogador(sender, pushName);

  // ─── AUTENTICAÇÕES POR SENHA ───
  if (cmd === 'admin') {
    const senhaDigitada = args[1];
    if (senhaDigitada === CONFIG.senhaAdmin) {
      sessoesAutenticadas.set(sender, 'admin');
      return sock.sendMessage(jid, { text: `✅ Painel Admin liberado! Digite */menuadmin*` });
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
    if (nivelAtuais !== 'admin' && nivelAtuais !== 'ntei') return sock.sendMessage(jid, { text: `❌ Acesso negado.` });
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

  if (cmd === 'menuntei') {
    if (nivelAtuais !== 'ntei') return sock.sendMessage(jid, { text: `❌ Permissão OMEGA Requerida.` });
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

⚠️ SISTEMA OPERACIONAL TANGERINA OS
⚠️ NÍVEL DE ACESSO: OMEGA`;
    return sock.sendMessage(jid, { text: menuNtei });
  }

  // ─── ECONOMIA POR ID ───
  if (cmd === 'transferir' || cmd === 'transferencia') {
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\s(\d+)/);
    const motivo = body.split(/motivo:/i)[1] || 'Negociação Livre';

    if (!matchId || !matchVal) {
      return sock.sendMessage(jid, { text: `❌ Use o padrão: */transferir id:1003 1500 motivo:Compra*` });
    }

    const destId = parseInt(matchId[1]);
    const valor = parseInt(matchVal[1]);

    if (user.ienes < valor) return sock.sendMessage(jid, { text: `❌ Você não tem ${valor} Ienes suficientes.` });

    const destino = buscarJogadorPorId(destId);
    if (!destino) return sock.sendMessage(jid, { text: `❌ Destinatário com o ID ${destId} não existe.` });

    user.ienes -= valor;
    destino.ienes += valor;

    atualizarJogador(sender, user);
    atualizarJogador(destino.jid, destino);

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

  if (cmd === 'add-ienes') {
    if (nivelAtuais === 'user') return;
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\s(\d+)/);
    if (!matchId || !matchVal) return sock.sendMessage(jid, { text: `❌ Uso: */add-ienes id:1003 500*` });

    const tgt = buscarJogadorPorId(matchId[1]);
    if (!tgt) return sock.sendMessage(jid, { text: `❌ ID não encontrado.` });

    tgt.ienes += parseInt(matchVal[1]);
    atualizarJogador(tgt.jid, tgt);
    return sock.sendMessage(jid, { text: `🪙 Adicionado com sucesso ao ID ${tgt.id_rpg}.` });
  }

  if (cmd === 'rm-ienes') {
    if (nivelAtuais === 'user') return;
    const matchId = body.match(/id:(\d+)/i);
    const matchVal = body.match(/\s(\d+)/);
    if (!matchId || !matchVal) return sock.sendMessage(jid, { text: `❌ Uso: */rm-ienes id:1003 500*` });

    const tgt = buscarJogadorPorId(matchId[1]);
    if (!tgt) return sock.sendMessage(jid, { text: `❌ ID não encontrado.` });

    tgt.ienes = Math.max(0, tgt.ienes - parseInt(matchVal[1]));
    atualizarJogador(tgt.jid, tgt);
    return sock.sendMessage(jid, { text: `✅ Removido o valor do ID ${tgt.id_rpg}.` });
  }

  if (cmd === 'tabela-ienes') {
    const db = carregarDB();
    const list = Object.values(db.jogadores);
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

  // ─── PLACAR DE LUTAS AUTOMÁTICO ───
  if (cmd === 'plc' || cmd === 'placar') {
    const id1 = parseInt(args[1]);
    const id2 = parseInt(args[2]);
    if (!id1 || !id2) return sock.sendMessage(jid, { text: `❌ Use: */plc ID1 ID2*` });

    const p1 = buscarJogadorPorId(id1);
    const p2 = buscarJogadorPorId(id2);

    if (!p1 || !p2) return sock.sendMessage(jid, { text: `❌ Um ou ambos os IDs informados não existem.` });

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

  // ─── ESCOLHER FAMÍLIA OU RAÇA ───
  if (cmd === 'escolher') {
    const tipo = args[1]?.toLowerCase();
    const escolha = resto.slice(1).join(' ');

    if (tipo === 'raça' || tipo === 'raca') {
      if (escolha.toLowerCase() === 'humano' || escolha.toLowerCase() === 'oni') {
        user.raca = escolha.toLowerCase() === 'oni' ? '👹 Oni' : '👱🏻‍♂️ Humano';
        atualizarJogador(sender, user);
        return sock.sendMessage(jid, { text: `🧬 Raça definida para *${escolha}* com sucesso!` });
      }
    }

    if (tipo === 'família' || tipo === 'familia') {
      user.familia = escolha;
      atualizarJogador(sender, user);
      return sock.sendMessage(jid, { text: `⛩️ Sua família agora é *${escolha}*!` });
    }
  }

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

  // ─── INVENTÁRIO DE CARDS INDIVIDUAL ───
  if (bodyLow.startsWith('/salvar inventário') || bodyLow.startsWith('/salvarinventario')) {
    const textoCards = body.substring(body.indexOf(' ')).trim();
    if (!textoCards) return sock.sendMessage(jid, { text: `❌ Insira o conteúdo dos cards.` });

    const db = carregarDB();
    db.inventarios[sender] = textoCards;
    salvarDB(db);
    return sock.sendMessage(jid, { text: `🎒 Cards salvos e sincronizados com sucesso!` });
  }

  if (cmd === 'inventario' || cmd === 'inventário') {
    const db = carregarDB();
    const inv = db.inventarios[sender];
    if (!inv) return sock.sendMessage(jid, { text: `❌ Use: /salvar inventário + Seus Cards` });
    return sock.sendMessage(jid, { text: `🎒 *SEUS CARDS SALVOS:*\n\n${inv}` });
  }

  // ─── LOJA DE FICHAS CUSTOMIZADA ───
  if (bodyLow.includes('loja de fichas') && (nivelAtuais === 'admin' || nivelAtuais === 'ntei')) {
    const ldb = carregarLoja();
    ldb.loja_fichas = body;
    salvarLoja(ldb);
    return sock.sendMessage(jid, { text: `🏪 Molde de loja atualizado com sucesso!` });
  }

  if (cmd === 'loja-rk') {
    const ldb = carregarLoja();
    if (!ldb.loja_fichas) return sock.sendMessage(jid, { text: `🏪 Nenhuma loja de fichas foi salva pela administração ainda.` });
    return sock.sendMessage(jid, { text: ldb.loja_fichas });
  }
}

// ══════════════════════════════════════════
//         SESSÃO CONEXÃO BAILEYS
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
      console.log('🍊 Tangerina OS carregado via JSON Database sem erros!');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (msg.key.fromMe || !msg.message) continue;
      try {
        await gerenciarMensagem(sock, msg);
      } catch (err) {
        console.error('Erro no processador:', err);
      }
    }
  });
}

conectarNtei();
