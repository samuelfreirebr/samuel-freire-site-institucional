/* ============================================================
   Métricas dos sites dos clientes.

   Cada site feito por nós leva uma linha no <head>:
     <script src="https://links.samuelfreire.com.br/m.js" data-site="<id>" defer></script>
   O script manda para /m: visita, cliques em ligar, WhatsApp, e-mail,
   redes e mapa, formulário começado, lead enviado e tempo na página.
   Sem cookie: o visitante vira um código sorteado no navegador dele,
   que só serve para contar pessoas diferentes.

   Só entra dado de site cadastrado e vindo de um domínio dele.
   Um arquivo por site (/dados/metricas/<id>.json), com um resumo por
   dia, gravado no máximo a cada 5 segundos.
   ============================================================ */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { RAIZ_DADOS } from './dados.js';

const PASTA = path.join(RAIZ_DADOS, 'metricas');
const ARQ_SITES = path.join(PASTA, 'sites.json');
const DIAS = 400;              // guarda pouco mais de um ano
const UNICOS = 5000;           // teto de visitantes diferentes por dia
const ROBO = /bot|crawl|spider|slurp|preview|whatsapp|facebookexternalhit|telegram|curl|wget|python|monitor|lighthouse|headless/i;
export const TIPOS = ['visita', 'tempo', 'ligar', 'whatsapp', 'email', 'sms', 'social', 'mapa', 'form-inicio', 'lead'];

const idValido = (id) => /^[a-z0-9][a-z0-9-]{1,40}$/.test(id || '');
const hojeBr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
const corte = (s, n) => String(s ?? '').trim().slice(0, n);

/* ---------- sites cadastrados ---------- */

let sites = null;
export async function listarSites() {
  if (sites) return sites;
  try { sites = JSON.parse(await fs.readFile(ARQ_SITES, 'utf8')); } catch { sites = []; }
  return sites;
}

/* Cria ou atualiza pelo id. Domínio entra sem protocolo e sem barra. */
export async function salvarSite(d) {
  const id = corte(d.id, 41).toLowerCase();
  if (!idValido(id)) throw new Error('Código do site inválido: use letras minúsculas, números e hífen.');
  const nome = corte(d.nome, 120);
  if (!nome) throw new Error('Dê um nome ao site.');
  const dominios = [...new Set((Array.isArray(d.dominios) ? d.dominios : String(d.dominios || '').split(/[\s,]+/))
    .map((x) => String(x).toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').trim())
    .filter((x) => /^[a-z0-9.-]+(:\d+)?$/.test(x)))].slice(0, 10);
  if (!dominios.length) throw new Error('Informe pelo menos um domínio do site.');
  const lista = await listarSites();
  const site = { id, nome, dominios, criadoEm: lista.find((s) => s.id === id)?.criadoEm || new Date().toISOString() };
  sites = [...lista.filter((s) => s.id !== id), site];
  await fs.mkdir(PASTA, { recursive: true });
  await fs.writeFile(ARQ_SITES + '.tmp', JSON.stringify(sites, null, 1), 'utf8');
  await fs.rename(ARQ_SITES + '.tmp', ARQ_SITES);
  return site;
}

/* ---------- dados por site ---------- */

const cache = new Map();     // id -> { dias: { 'AAAA-MM-DD': {...} } }
const timers = new Map();

async function carregar(id) {
  if (cache.has(id)) return cache.get(id);
  let s;
  try { s = JSON.parse(await fs.readFile(path.join(PASTA, id + '.json'), 'utf8')); } catch { s = {}; }
  s.dias ||= {};
  cache.set(id, s);
  return s;
}

function gravar(id) {
  clearTimeout(timers.get(id));
  timers.set(id, setTimeout(async () => {
    const s = cache.get(id);
    for (const d of Object.keys(s.dias).sort().slice(0, -DIAS)) delete s.dias[d];
    const arq = path.join(PASTA, id + '.json');
    await fs.mkdir(PASTA, { recursive: true });
    await fs.writeFile(arq + '.tmp', JSON.stringify(s), 'utf8');
    await fs.rename(arq + '.tmp', arq);
  }, 5000));
}

const novoDia = () => ({ visitas: 0, unicos: [], celular: 0, paginas: {}, origens: {}, tempoMs: 0, tempoN: 0,
  ligar: 0, whatsapp: 0, email: 0, sms: 0, social: 0, mapa: 0, 'form-inicio': 0, lead: 0 });

/* De onde veio: utm_source vence; depois o domínio de quem mandou. */
function origemDe(ref, busca) {
  const utm = /(?:^|[?&])utm_source=([^&]+)/.exec(busca || '')?.[1];
  if (utm) return corte(decodeURIComponent(utm).toLowerCase(), 40);
  let host = '';
  try { host = new URL(ref).hostname.replace(/^www\./, ''); } catch { return 'direto'; }
  if (/(^|\.)google\./.test(host)) return 'google';
  if (/(^|\.)(bing|yahoo|duckduckgo)\./.test(host)) return 'outros buscadores';
  if (/instagram\./.test(host)) return 'instagram';
  if (/(facebook|fb)\./.test(host)) return 'facebook';
  if (/(tiktok|youtube|linkedin)\./.test(host)) return host.split('.')[0];
  return corte(host, 60) || 'direto';
}

/* Recebe um evento do script. Devolve false quando não vale. */
export async function registrar(req, corpo) {
  if (ROBO.test(req.headers['user-agent'] || '')) return false;
  let e;
  try { e = JSON.parse(corpo); } catch { return false; }
  const site = (await listarSites()).find((s) => s.id === e?.s);
  if (!site || !TIPOS.includes(e.t)) return false;
  // Só aceita o que vem de um domínio do próprio site.
  let host = '';
  try { host = new URL(req.headers.origin || req.headers.referer || '').host.replace(/^www\./, ''); } catch { return false; }
  if (!site.dominios.some((d) => d.replace(/^www\./, '') === host)) return false;

  const s = await carregar(site.id), dia = s.dias[hojeBr()] ||= novoDia();
  if (e.t === 'visita') {
    dia.visitas++;
    const quem = corte(e.v, 16);
    if (quem && !dia.unicos.includes(quem) && dia.unicos.length < UNICOS) dia.unicos.push(quem);
    if (e.m) dia.celular++;
    const pag = corte(e.p, 120) || '/';
    dia.paginas[pag] = (dia.paginas[pag] || 0) + 1;
    const o = origemDe(e.r, e.q);
    dia.origens[o] = (dia.origens[o] || 0) + 1;
  } else if (e.t === 'tempo') {
    const ms = Number(e.ms);
    if (ms > 1000 && ms < 2 * 3600e3) { dia.tempoMs += ms; dia.tempoN++; }
  } else {
    dia[e.t]++;
  }
  gravar(site.id);
  return true;
}

/* ---------- resumo para o painel ---------- */

const somar = (obj, mais) => { for (const [k, v] of Object.entries(mais)) obj[k] = (obj[k] || 0) + v; return obj; };

function periodo(s, ini, n) {
  const t = novoDia(), pessoas = new Set(), dias = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - (ini + i) * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
    const x = s.dias[d];
    dias.push({ dia: d, visitas: x?.visitas || 0, contatos: x ? x.ligar + x.whatsapp + x.email + x.sms + x.lead : 0 });
    if (!x) continue;
    for (const k of ['visitas', 'celular', 'tempoMs', 'tempoN', 'ligar', 'whatsapp', 'email', 'sms', 'social', 'mapa', 'form-inicio', 'lead']) t[k] += x[k] || 0;
    x.unicos.forEach((u) => pessoas.add(u));
    somar(t.paginas, x.paginas); somar(t.origens, x.origens);
  }
  const top = (o, n) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([nome, n]) => ({ nome, n }));
  return {
    visitas: t.visitas, visitantes: pessoas.size, celular: t.celular,
    tempoMedio: t.tempoN ? Math.round(t.tempoMs / t.tempoN / 1000) : 0,
    ligar: t.ligar, whatsapp: t.whatsapp, email: t.email, sms: t.sms, social: t.social, mapa: t.mapa,
    formInicio: t['form-inicio'], leads: t.lead,
    contatos: t.ligar + t.whatsapp + t.email + t.sms + t.lead,
    paginas: top(t.paginas, 8), origens: top(t.origens, 6), dias,
  };
}

/* Período pedido e o anterior, do mesmo tamanho, para comparar. */
export async function resumo(id, n = 15) {
  const site = (await listarSites()).find((s) => s.id === id);
  if (!site) return null;
  n = Math.min(Math.max(Number(n) || 15, 1), 365);
  const s = await carregar(id);
  return { site, dias: n, atual: periodo(s, 0, n), anterior: periodo(s, n, n), geradoEm: new Date().toISOString() };
}

/* ---------- o script que vai nos sites ----------
   Minúsculo, sem dependência, não atrasa a página (defer). O lead
   vem do evento generate_lead que os nossos formulários já mandam
   para o dataLayer; window.sfMetrica('lead') também funciona.
   ponytail: o lead depende de envolver o dataLayer.push; se um dia o
   site usar o Google Tag Manager (que troca o push), chamar
   window.sfMetrica('lead') no sucesso do formulário. */
export const SCRIPT = `(()=>{try{
var s=document.currentScript,site=s&&s.dataset.site;if(!site)return;
var u=new URL(s.src).origin+"/m",v="";
try{v=localStorage.getItem("sf_v");if(!v){v=Math.random().toString(36).slice(2,12);localStorage.setItem("sf_v",v)}}catch(e){}
var env=function(t,x){var b=JSON.stringify(Object.assign({s:site,t:t,v:v,p:location.pathname},x||{}));
if(navigator.sendBeacon&&navigator.sendBeacon(u,b))return;fetch(u,{method:"POST",body:b,keepalive:true}).catch(function(){})};
window.sfMetrica=env;
var r="";try{if(document.referrer&&new URL(document.referrer).host!==location.host)r=document.referrer}catch(e){}
env("visita",{r:r,q:location.search,m:matchMedia("(max-width: 767px)").matches?1:0});
var ini=Date.now(),foi=0;addEventListener("pagehide",function(){if(!foi){foi=1;env("tempo",{ms:Date.now()-ini})}});
document.addEventListener("click",function(e){var a=e.target.closest&&e.target.closest("a[href]");if(!a)return;var h=a.getAttribute("href")||"",t=
/^tel:/i.test(h)?"ligar":/wa\\.me|whatsapp\\.com/i.test(h)?"whatsapp":/^mailto:/i.test(h)?"email":/^sms:/i.test(h)?"sms":
/google\\.[a-z.]+\\/maps|maps\\.app\\.goo|goo\\.gl\\/maps/i.test(h)?"mapa":/instagram|facebook|tiktok|youtube|linkedin/i.test(h)?"social":"";if(t)env(t)},true);
var comecou=0;document.addEventListener("input",function(e){if(!comecou&&e.target.closest&&e.target.closest("form")){comecou=1;env("form-inicio")}},true);
var dl=window.dataLayer=window.dataLayer||[],p=dl.push;dl.push=function(){for(var i=0;i<arguments.length;i++){var o=arguments[i];if(o&&o.event==="generate_lead")env("lead")}return p.apply(dl,arguments)};
}catch(e){}})();`;
