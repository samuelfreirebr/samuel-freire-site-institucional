/* ============================================================
   Novidades do painel: visitas do site e o que o cliente fez
   (abriu a proposta, abriu ou respondeu o formulário).

   Visita: uma por pessoa por dia, sem cookie. A pessoa vira um
   resumo (hash) de IP + navegador + dia, que muda todo dia e não
   volta a ser IP. Robôs e o Samuel logado não contam.
   Tudo num arquivo só (/dados/novidades.json), gravado no máximo
   a cada 5 segundos.
   ============================================================ */

import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { RAIZ_DADOS } from './dados.js';

const ARQ = path.join(RAIZ_DADOS, 'novidades.json');
const DIAS = 90;          // guarda 90 dias de visitas
const EVENTOS = 300;      // e os últimos 300 acontecimentos
const VOLTOU = 6 * 3600e3; // reabrir a proposta só avisa de novo depois de 6 horas
const ROBO = /bot|crawl|spider|slurp|preview|whatsapp|facebookexternalhit|telegram|curl|wget|python|monitor|lighthouse|headless/i;

let estado = null, gravando = null;
const hojeBr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

async function carregar() {
  if (estado) return estado;
  try { estado = JSON.parse(await fs.readFile(ARQ, 'utf8')); } catch { estado = {}; }
  estado.visitas ||= {}; estado.eventos ||= []; estado.vistos ||= {};
  estado.sal ||= randomBytes(16).toString('hex');
  estado.hoje ||= { dia: '', pessoas: [] };
  return estado;
}

function gravar() {
  clearTimeout(gravando);
  gravando = setTimeout(async () => {
    const dias = Object.keys(estado.visitas).sort();
    for (const d of dias.slice(0, -DIAS)) delete estado.visitas[d];
    estado.eventos = estado.eventos.slice(-EVENTOS);
    await fs.mkdir(RAIZ_DADOS, { recursive: true });
    await fs.writeFile(ARQ + '.tmp', JSON.stringify(estado), 'utf8');
    await fs.rename(ARQ + '.tmp', ARQ);
  }, 5000);
}

const ip = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();

/* Página do site aberta por alguém de fora. */
export async function contarVisita(req) {
  const ua = req.headers['user-agent'] || '';
  if (!ua || ROBO.test(ua)) return;
  const s = await carregar(), dia = hojeBr();
  if (s.hoje.dia !== dia) s.hoje = { dia, pessoas: [] };
  const quem = createHash('sha256').update(`${s.sal}|${dia}|${ip(req)}|${ua}`).digest('hex').slice(0, 16);
  if (s.hoje.pessoas.includes(quem)) return;
  s.hoje.pessoas.push(quem);
  s.visitas[dia] = (s.visitas[dia] || 0) + 1;
  gravar();
}

/* O cliente abriu a proposta ou o formulário. A primeira vez sempre
   avisa; as seguintes, só se passou um tempo. */
export async function abriu(req, tipo, id, titulo, link) {
  if (ROBO.test(req.headers['user-agent'] || '')) return;
  const s = await carregar(), chave = `${tipo}:${id}`, agora = Date.now();
  const v = s.vistos[chave] ||= { vezes: 0, primeira: agora, ultima: 0 };
  const avisa = !v.vezes || agora - v.ultima > VOLTOU;
  if (avisa) s.eventos.push({ tipo: v.vezes ? `${tipo}-voltou` : `${tipo}-aberta`, id, titulo, link, quando: new Date(agora).toISOString() });
  v.vezes++; v.ultima = agora;
  gravar();
}

export async function registrar(tipo, id, titulo, link) {
  const s = await carregar();
  s.eventos.push({ tipo, id, titulo, link, quando: new Date().toISOString() });
  gravar();
}

export async function resumo() {
  const s = await carregar();
  const dias = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    dias.push({ dia: d, n: s.visitas[d] || 0 });
  }
  const soma = (n) => dias.slice(-n).reduce((t, d) => t + d.n, 0);
  return {
    visitas: { hoje: soma(1), semana: soma(7), mes: soma(30), dias },
    eventos: s.eventos.slice(-100).reverse(),
    vistos: s.vistos,
  };
}
