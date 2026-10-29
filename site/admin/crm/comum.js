/* Peças que a tela do CRM e a ficha do cliente usam igual. */

export const $ = (s, raiz = document) => raiz.querySelector(s);
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NOMES_ESTADO = { hoje: 'Hoje', semana: 'Semana', aguardando: 'Aguardando', backlog: 'Depois', feita: 'Feita' };
export const ATIVOS = ['fechado', 'andamento', 'entregue'];   // etapas de quem já é cliente

export function avisar(msg, tipo = 'ok') {
  const a = $('#aviso');
  a.textContent = msg; a.dataset.tipo = tipo; a.classList.add('mostra');
  clearTimeout(avisar.t); avisar.t = setTimeout(() => a.classList.remove('mostra'), 3500);
}

export async function pedir(url, opcoes = {}) {
  const r = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opcoes });
  if (r.status === 401) { location.replace('/admin/entrar?voltar=' + encodeURIComponent(location.pathname)); throw new Error('Faça login.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Não deu para salvar.');
  return d;
}

// Propostas, faturas e formulários do painel. Se algum falhar, vem vazio.
export async function documentos() {
  const ler = (u, k) => fetch(u).then((r) => (r.ok ? r.json() : {})).then((d) => d[k] || []).catch(() => []);
  const [propostas, faturas, formularios] = await Promise.all([
    ler('/api/propostas', 'propostas'), ler('/api/faturas', 'faturas'), ler('/api/formularios', 'formularios'),
  ]);
  return { propostas, faturas, formularios };
}

// O nome do cliente no CRM e o da proposta/fatura raramente batem letra por letra.
export function mesmoCliente(nomeCrm, outro) {
  const a = String(nomeCrm || '').toLowerCase().trim(), b = String(outro || '').toLowerCase().trim();
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

export function dinheiro(valor, moeda = 'BRL') {
  try { return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: moeda, maximumFractionDigits: 0 }).format(Number(valor) || 0); }
  catch (e) { return `${moeda} ${Math.round(Number(valor) || 0)}`; }
}

export const hojeIso = () => new Date().toLocaleDateString('en-CA');   // AAAA-MM-DD no fuso de quem abre
export const dataCurta = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');
export const diasAte = (iso) => Math.round((new Date(iso + 'T12:00') - new Date(hojeIso() + 'T12:00')) / 864e5);

export function quando(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `há ${d} dia${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('pt-BR');
}

export const abertas = (c) => (c.atividades || []).filter((a) => a.estado !== 'feita');
export const atrasadas = (c) => abertas(c).filter((a) => a.prazo && a.prazo < hojeIso());
export function proximaEntrega(c) {
  return abertas(c).filter((a) => a.prazo && a.prazo >= hojeIso()).sort((x, y) => x.prazo.localeCompare(y.prazo))[0] || null;
}

export const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
