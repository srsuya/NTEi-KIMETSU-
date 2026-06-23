/**
 * Extrai o texto de uma mensagem do WhatsApp, considerando mensagens
 * efêmeras, view-once e legendas de imagem/vídeo.
 */
export function extractText(msg) {
    const m = msg.message;
    if (!m) return '';
    const inner =
        m.ephemeralMessage?.message ||
        m.viewOnceMessage?.message ||
        m.viewOnceMessageV2?.message ||
        m.documentWithCaptionMessage?.message ||
        m;

    return (
        inner.conversation ||
        inner.extendedTextMessage?.text ||
        inner.imageMessage?.caption ||
        inner.videoMessage?.caption ||
        inner.buttonsResponseMessage?.selectedButtonId ||
        inner.listResponseMessage?.singleSelectReply?.selectedRowId ||
        ''
    );
}

/**
 * Procura, dentro de uma lista de linhas de texto, um campo que comece
 * com um dos termos informados (ex: "Nick:", "Família:") e retorna o
 * valor já limpo de emojis/marcadores decorativos.
 */
export function extrairCampo(lines, ...termos) {
    for (const termo of termos) {
        const linha = lines.find(l => l.toLowerCase().includes(termo.toLowerCase()));
        if (!linha) continue;

        const partes = linha.split(/[:⌊⌉]/);
        for (let i = partes.length - 1; i >= 0; i--) {
            const val = partes[i]
                .replace(/[⌊⌉◈￫🆔🧾⛩️🏙️🔘✒️_*]/g, '')
                .trim();
            if (val && val.length > 0) return val;
        }
    }
    return null;
}

/**
 * Extrai o ID numérico de um argumento no formato "id:1001" ou apenas "1001".
 */
export function extrairId(arg) {
    if (!arg) return null;
    const match = String(arg).match(/(\d+)/);
    return match ? Number(match[1]) : null;
}

/**
 * Converte um valor textual (ex: "1.500" ou "1500") em número inteiro.
 */
export function parseValor(texto) {
    if (!texto) return null;
    const limpo = String(texto).replace(/\./g, '').replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const valor = Number(limpo);
    return Number.isFinite(valor) ? Math.round(valor) : null;
}
