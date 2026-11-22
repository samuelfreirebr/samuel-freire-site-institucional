/* ============================================================
   Painel do cliente: leads do site e acesso com e-mail e senha.

   Leads: o formulário do site do cliente manda o pedido para /l.
   Só entra pedido de site cadastrado nas métricas, vindo de um
   domínio dele (metricas.siteDoPedido). Um arquivo por site
   (/dados/leads/<id>.json), o mais novo primeiro.

   Acesso: o Samuel cria, no /admin/metricas, o e-mail e a senha de
   cada cliente. A senha fica só como hash (scrypt com sal), então
   nem quem lê o arquivo descobre qual é; perdeu, cria outra.
   A sessão do cliente é um cookie assinado que leva um pedaço do
   hash: trocar a senha ou desligar o acesso derruba a sessão.
   ============================================================ */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { createHmac, randomBytes, scryptSync } from 'node:crypto';
import { RAIZ_DADOS } from './dados.js';
import { iguais, enderecoDe } from './seguranca.js';
import * as metricas from './metricas.js';
import * as push from './push.js';

const PASTA_LEADS = path.join(RAIZ_DADOS, 'leads');
const ARQ_ACESSOS = path.join(RAIZ_DADOS, 'metricas', 'acessos.json');
const MAX_LEADS = 2000;                        // por site
const COOKIE = 'cliente';
const DURACAO_MS = 30 * 24 * 60 * 60 * 1000;  // um mês

const corte = (s, n) => String(s ?? '').trim().slice(0, n);

async function gravarJson(arq, dado) {
  await fs.mkdir(path.dirname(arq), { recursive: true });
  await fs.writeFile(arq + '.tmp', JSON.stringify(dado, null, 1), 'utf8');
  await fs.rename(arq + '.tmp', arq);
}
const lerJson = async (arq, padrao) => { try { return JSON.parse(await fs.readFile(arq, 'utf8')); } catch { return padrao; } };

/* ---------- leads ---------- */

// Freio contra robô: no máximo 10 pedidos por hora do mesmo endereço.
const envios = new Map();
function demais(req) {
  const ip = enderecoDe(req), agora = Date.now();
  const lista = (envios.get(ip) || []).filter((t) => agora - t < 3600e3);
  lista.push(agora);
  envios.set(ip, lista);
  if (envios.size > 5000) envios.clear();
  return lista.length > 10;
}

/* Recebe o pedido do formulário. Devolve o erro em texto, ou '' se gravou. */
export async function registrarLead(req, corpo) {
  let e;
  try { e = JSON.parse(corpo); } catch { return 'JSON inválido.'; }
  const site = await metricas.siteDoPedido(req, e?.s);
  if (!site) return 'Site não cadastrado.';
  if (corte(e.empresa, 1)) return '';                       // campo isca preenchido: robô, finge que deu certo
  if (demais(req)) return 'Muitos pedidos. Tente mais tarde.';
  const lead = {
    id: Date.now().toString(36) + randomBytes(3).toString('hex'),
    em: new Date().toISOString(),
    nome: corte(e.nome, 120),
    telefone: corte(e.telefone, 40),
    email: corte(e.email, 160),
    cep: corte(e.cep, 12),
    servicos: (Array.isArray(e.servicos) ? e.servicos : []).map((x) => corte(x, 80)).filter(Boolean).slice(0, 12),
    mensagem: corte(e.mensagem, 3000),
    pagina: corte(e.pagina, 200),
  };
  if (!lead.nome || !(lead.telefone || lead.email)) return 'Faltam nome e telefone.';
  const arq = path.join(PASTA_LEADS, site.id + '.json');
  const lista = await lerJson(arq, []);
  lista.unshift(lead);
  await gravarJson(arq, lista.slice(0, MAX_LEADS));
  metricas.contar(site.id, 'lead').catch(() => {});
  push.avisar({ titulo: '💬 Lead novo', texto: `${site.nome}: ${lead.nome}`, url: '/admin/metricas/?site=' + site.id }).catch(() => {});
  return '';
}

export const listarLeads = (id) => lerJson(path.join(PASTA_LEADS, id + '.json'), []);

/* ---------- acesso do cliente ---------- */

const hashDe = (senha, sal) => scryptSync(String(senha), sal, 32).toString('base64url');
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export const listarAcessos = () => lerJson(ARQ_ACESSOS, []);

/* O que o painel do Samuel mostra: nunca o hash. */
export async function acessoDoSite(id) {
  const a = (await listarAcessos()).find((x) => x.site === id);
  return a ? { email: a.email, ativo: a.ativo, criadoEm: a.criadoEm, senhaEm: a.senhaEm } : null;
}

/* Cria ou atualiza o acesso de um site. Senha vazia mantém a atual. */
export async function salvarAcesso(id, d) {
  const site = (await metricas.listarSites()).find((s) => s.id === id);
  if (!site) throw new Error('Site não encontrado.');
  const email = corte(d.email, 160).toLowerCase();
  if (!emailOk(email)) throw new Error('E-mail inválido.');
  const lista = await listarAcessos();
  if (lista.some((x) => x.email === email && x.site !== id)) throw new Error('Esse e-mail já entra em outro site.');
  const antes = lista.find((x) => x.site === id);
  const senha = String(d.senha || '');
  if (!antes && !senha) throw new Error('Crie uma senha para o cliente.');
  if (senha && senha.length < 6) throw new Error('A senha precisa de pelo menos 6 caracteres.');
  const agora = new Date().toISOString();
  const a = { site: id, email, ativo: d.ativo !== false, criadoEm: antes?.criadoEm || agora, sal: antes?.sal, hash: antes?.hash, senhaEm: antes?.senhaEm };
  if (senha) { a.sal = randomBytes(16).toString('base64url'); a.hash = hashDe(senha, a.sal); a.senhaEm = agora; }
  await gravarJson(ARQ_ACESSOS, [...lista.filter((x) => x.site !== id), a]);
  return acessoDoSite(id);
}

/* Confere e-mail e senha. Devolve o acesso ou null. */
export async function conferir(email, senha) {
  const a = (await listarAcessos()).find((x) => x.email === corte(email, 160).toLowerCase() && x.ativo);
  // Calcula o hash mesmo sem conta, para o tempo não revelar quais e-mails existem.
  const h = hashDe(senha || '', a?.sal || 'sem-conta');
  return a && iguais(h, a.hash) ? a : null;
}

/* ---------- sessão do cliente ---------- */

const chave = () => createHmac('sha256', 'sessao-do-cliente').update(process.env.SENHA_PAINEL || '').digest();
const assinar = (corpo) => createHmac('sha256', chave()).update(corpo).digest('base64url');

export function criarSessao(a) {
  const corpo = [Date.now() + DURACAO_MS, Buffer.from(a.email).toString('base64url'), a.hash.slice(0, 12)].join('.');
  return corpo + '.' + assinar(corpo);
}

const ehHttps = (req) => (req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
export const cookieDeSessao = (req, token) =>
  `${COOKIE}=${token}; Path=/cliente; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(DURACAO_MS / 1000)}` + (ehHttps(req) ? '; Secure' : '');
export const cookieDeSaida = () => `${COOKIE}=; Path=/cliente; HttpOnly; SameSite=Lax; Max-Age=0`;

/* O acesso dono da sessão, se ela vale. */
export async function sessao(req) {
  if (!process.env.SENHA_PAINEL) return null;
  const cru = (req.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith(COOKIE + '='));
  const p = cru?.slice(COOKIE.length + 1).split('.') || [];
  if (p.length !== 4 || !iguais(p[3], assinar(p.slice(0, 3).join('.'))) || Number(p[0]) < Date.now()) return null;
  const email = Buffer.from(p[1], 'base64url').toString('utf8');
  const a = (await listarAcessos()).find((x) => x.email === email && x.ativo);
  return a && iguais(a.hash.slice(0, 12), p[2]) ? a : null;
}

/* Tudo o que o painel do cliente mostra, só do site dele. */
export async function painel(a, dias) {
  const r = await metricas.resumo(a.site, dias);
  if (!r) return null;
  return { site: { nome: r.site.nome }, dias: r.dias, atual: r.atual, anterior: r.anterior, leads: await listarLeads(a.site), email: a.email };
}
