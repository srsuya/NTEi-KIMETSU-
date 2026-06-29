import { BORDA_TOPO, BORDA_BOT, TITULO } from '../../utils/helpers.js';

export const MENU_GERAL =
`${BORDA_TOPO}
${TITULO}
         🍊 *MENU PRINCIPAL* 🍊

👤 *PERFIL & RPG*
👉 /id — Ver seu ID
👉 /perfil — Sua ficha completa
👉 /inventario — Ver inventário
👉 /familias — Ver famílias disponíveis
👉 /escolherfamilia [nome]
👉 /escolher raça [Humano/Oni]

💰 *ECONOMIA*
👉 /transferir id:XXXX valor Motivo
👉 /extrato — Histórico de transferências

🏪 *LOJAS*
👉 /loja — Loja de Ienes
👉 /lojafichas — Loja de Fichas
👉 /lojaeng — Loja de Engrenagens
👉 /comprar [nome do item]

⚔️ *BATALHAS*
👉 /vt [fácil/médio/difícil/impossível]
👉 /sc — Treino contra IA (fácil)
👉 /atacar, /defender, /fugir
👉 /usarcard [nome]

🃏 *CARDS*
👉 [Envie seus cards no formato padrão]
👉 /meuscards — Ver sua coleção
👉 /deletarcard [id]

📊 *RANKING*
👉 /rankingienes
👉 /rankingxp

📋 *LUTAS PLC*
👉 /historicolutas

ℹ️ *INFO*
👉 /ping — Verificar conexão
${BORDA_BOT}`;

export const MENU_ADMIN =
`${BORDA_TOPO}
   🛡️ *PAINEL ADMINISTRATIVO* 🛡️

💰 *ECONOMIA*
👉 /addienes @user [valor]
👉 /rmienes @user [valor]
👉 /addeng @user [valor]
👉 /rmeng @user [valor]
👉 /addfichas @user [valor]
👉 /rmfichas @user [valor]
👉 /addxp @user [valor]
👉 /rmxp @user [valor]
👉 /addtabela id:XXXX [valor]

🎖️ *PATENTES*
👉 /setpatente @user [patente]
👉 /setpatente id:XXXX [patente]

🧬 *RAÇA / FAMÍLIA*
👉 /resetraca @user
👉 /addfamilia [nome] | [descrição]

👥 *GRUPO*
👉 /banir @user
👉 /promover @user
👉 /rebaixar @user

🏪 *LOJAS*
👉 /criarloja [texto completo da loja]
👉 /additem Nome | Preço | Moeda | Desc

⚔️ *LUTAS*
👉 /plc id:XXXX id:XXXX
👉 /updateluta [id] hp1:XX hp2:XX en1:XX en2:XX
👉 /finalizarluta [id]

📢 *ANÚNCIOS*
👉 /anuncio Título | Texto | Assinatura
${BORDA_BOT}`;

export const MENU_NTEI =
`${BORDA_TOPO}
   👑 *PAINEL NTEi — SISTEMA MESTRE* 👑

🔐 *GERENCIAR ADMINS DO BOT*
👉 /addadminbot @user
👉 /removeadminbot @user
👉 /listaadmins

🧹 *MANUTENÇÃO*
👉 /resetusuario @user
👉 /resetraca @user

📊 *SISTEMA*
👉 /stats — Estatísticas gerais
👉 /ping
👉 /listaid
👉 /listajogadores
👉 /consultaid [id]
${BORDA_BOT}`;
