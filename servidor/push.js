/* ============================================================
   Notificação do próprio app (Web Push), sem serviço de fora.
   O iPhone mostra com o ícone e o nome do painel instalado na tela
   de início. Node puro: a criptografia do Web Push (RFC 8291) e a
   assinatura VAPID (RFC 8292) saem do node:crypto.

   As chaves VAPID nascem sozinhas no 1º uso e ficam no volume
   (push.json), junto com os aparelhos inscritos.
   ============================================================ */

import { createECDH, createHmac, createCipheriv, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { RAIZ_DADOS } from './dados.js';

const ARQ = join(RAIZ_DADOS, 'push.json');
const CONTATO = 'https://links.samuelfreire.com.br';
const b64 = (b) => Buffer.from(b).toString('base64url');
const hmac = (chave, dado) => createHmac('sha256', chave).update(dado).digest();

let estado = null;
async function carregar() {
  if (estado) return estado;
  try { estado = JSON.parse(await readFile(ARQ, 'utf8')); } catch { estado = { inscritos: [] }; }
  if (!estado.vapid) {
    const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = privateKey.export({ format: 'jwk' });
    estado.vapid = { jwk, publica: b64(Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, 'base64url'), Buffer.from(jwk.y, 'base64url')])) };
    await gravar();
  }
  return estado;
}
const gravar = () => mkdir(RAIZ_DADOS, { recursive: true }).then(() => writeFile(ARQ, JSON.stringify(estado), 'utf8'));

export const chavePublica = async () => (await carregar()).vapid.publica;

export async function inscrever(sub) {
  if (!/^https:\/\//.test(sub?.endpoint || '') || !sub.keys?.p256dh || !sub.keys?.auth) throw Object.assign(new Error('Inscrição inválida.'), { status: 400 });
  const s = await carregar();
  s.inscritos = s.inscritos.filter((x) => x.endpoint !== sub.endpoint);
  s.inscritos.push({ endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, desde: new Date().toISOString() });
  await gravar();
  return s.inscritos.length;
}

export async function sair(endpoint) {
  const s = await carregar();
  s.inscritos = s.inscritos.filter((x) => x.endpoint !== endpoint);
  await gravar();
  return s.inscritos.length;
}

/* corpo cifrado em aes128gcm (RFC 8291) */
export function cifrar(texto, p256dh, auth) {
  const ua = Buffer.from(p256dh, 'base64url');
  const ecdh = createECDH('prime256v1');
  const as = ecdh.generateKeys();
  const segredo = ecdh.computeSecret(ua);
  const ikm = hmac(hmac(Buffer.from(auth, 'base64url'), segredo), Buffer.concat([Buffer.from('WebPush: info\0'), ua, as, Buffer.from([1])]));
  const sal = randomBytes(16);
  const prk = hmac(sal, ikm);
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16);
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12);
  const c = createCipheriv('aes-128-gcm', cek, nonce);
  const cifrado = Buffer.concat([c.update(Buffer.concat([Buffer.from(texto), Buffer.from([2])])), c.final(), c.getAuthTag()]);
  const rs = Buffer.alloc(4); rs.writeUInt32BE(4096);
  return Buffer.concat([sal, rs, Buffer.from([as.length]), as, cifrado]);
}

/* JWT ES256 do VAPID para o servidor de push (Apple, Google, Mozilla) */
function vapid(endpoint, v) {
  const corpo = b64(JSON.stringify({ typ: 'JWT', alg: 'ES256' })) + '.' + b64(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: CONTATO }));
  const assinatura = sign('sha256', Buffer.from(corpo), { key: createPrivateKey({ key: v.jwk, format: 'jwk' }), dsaEncoding: 'ieee-p1363' });
  return `vapid t=${corpo}.${b64(assinatura)}, k=${v.publica}`;
}

/* manda para todos os aparelhos inscritos; tira os que o servidor de push diz que sumiram */
export async function avisar({ titulo, texto, url = '/' }) {
  const s = await carregar();
  const corpo = JSON.stringify({ titulo, texto, url });
  const res = await Promise.all(s.inscritos.map(async (x) => {
    try {
      const r = await fetch(x.endpoint, {
        method: 'POST',
        headers: { authorization: vapid(x.endpoint, s.vapid), 'content-encoding': 'aes128gcm', 'content-type': 'application/octet-stream', ttl: '86400', urgency: 'high' },
        body: cifrar(corpo, x.keys.p256dh, x.keys.auth),
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404 || r.status === 410) x.sumiu = true;
      else if (!r.ok) console.error('push', r.status, (await r.text()).slice(0, 200));
      return r.ok;
    } catch (e) { console.error('push', e.message); return false; }
  }));
  if (s.inscritos.some((x) => x.sumiu)) { s.inscritos = s.inscritos.filter((x) => !x.sumiu); await gravar(); }
  return { enviados: res.filter(Boolean).length, aparelhos: s.inscritos.length };
}
