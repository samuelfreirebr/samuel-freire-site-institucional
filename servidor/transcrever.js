/* ============================================================
   Transcrição do áudio do briefing.

   O cliente grava a resposta no navegador; o briefing.js converte
   para WAV (mono, 16 kHz) e manda para /perguntas/<link>/audio.
   Daqui o áudio vai para o OpenRouter, e o texto volta para o
   campo, onde o cliente confere e corrige antes de enviar.

   Chave: OPENROUTER_API_KEY na stack. Modelo: OPENROUTER_MODELO_AUDIO
   (padrão google/gemini-2.5-flash, bom em português e barato).
   Sem chave, o botão de áudio nem aparece na página.
   ============================================================ */

export const LIMITE_AUDIO = 12 * 1024 * 1024;   // 5 min de WAV a 16 kHz dão uns 9,6 MB

export const temChaveAudio = () => Boolean(process.env.OPENROUTER_API_KEY);

/* A pergunta do briefing NÃO vai junto: com ela, um áudio sem fala
   voltava com uma resposta inventada (um endereço completo, no teste).
   Sem fala, a IA devolve o sinal SEM_FALA e o campo fica como estava. */
const SEM_FALA = '[sem fala]';
const PEDIDO = 'Transcreva fielmente, em português do Brasil, o que a pessoa fala neste áudio. '
  + 'Devolva só as palavras ditas, sem comentários, sem título e sem aspas. Ajuste apenas a '
  + 'pontuação e tire hesitações como "é...", "hum". Nunca invente, complete ou resuma nada. '
  + `Se não houver fala humana clara, responda exatamente ${SEM_FALA}`;

export async function transcrever(wav) {
  const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'x-title': 'Briefing Samuel Freire',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODELO_AUDIO || 'google/gemini-2.5-flash',
      temperature: 0,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PEDIDO },
          { type: 'input_audio', input_audio: { data: wav.toString('base64'), format: 'wav' } },
        ],
      }],
    }),
    signal: AbortSignal.timeout(120000),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error?.message || 'A transcrição falhou.');
  const texto = String(d.choices?.[0]?.message?.content ?? '').trim();
  return texto.includes(SEM_FALA) ? '' : texto;
}
