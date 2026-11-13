/* Peças que as telas do CRM e a ficha do cliente usam igual: textos,
   datas, a lista de tarefas, o editor de tarefa, a busca rápida
   (Ctrl/Cmd+K) e o pedido pronto para o Claude Code. */

import { ico } from '../icones.js';

/* ---------- Central de ajustes ---------- */
export const DIAS_LEAD_PARADO = 7;     // lead sem movimento há este tanto de dias vira "parado"
export const DIAS_PROXIMAS = 14;       // janela das "próximas entregas"
const PASTA_PROJETOS = 'Meu Drive/PROJETOS : PORTFÓLIO';   // vai no pedido para o Claude
export const EQUIPE = ['Samuel'];      // quem pode ser responsável por uma tarefa (acrescente o nome de quem entrar no time)
export const MINUTOS_FILA_CLAUDE = 30; // de quanto em quanto tempo o Claude do Mac olha a fila
const SALVAR_DEPOIS_MS = 600;          // o painel da tarefa grava sozinho este tanto depois da última mudança

export const $ = (s, raiz = document) => raiz.querySelector(s);
export const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NOMES = {
  estado: { afazer: 'A fazer', andamento: 'Fazendo', aguardando: 'Aguardando', feita: 'Feita' },
  prioridade: { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baixa: 'Baixa' },
  origem: { whatsapp: 'WhatsApp', instagram: 'Instagram', indicacao: 'Indicação', prospeccao: 'Prospecção', site: 'Site', outro: 'Outro' },
  claude: { fila: 'Na fila do Claude', trabalhando: 'Claude fazendo', precisa: 'Claude precisa de você', feita: 'Feita pelo Claude' },
  grupo: { atrasada: 'Atrasadas', hoje: 'Hoje', semana: 'Próximos 7 dias', depois: 'Depois', semprazo: 'Sem prazo', aguardando: 'Aguardando alguém', feita: 'Feitas' },
};
export const LEADS = ['lead', 'proposta', 'followup', 'assinatura']; // ainda não fechou: contrato assinado ou pago vira cliente
const PESO_PRIORIDADE = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

/* ---------- avisos e API ---------- */

/* `acao` opcional: { rotulo, fn } vira um botão no aviso (ex.: Desfazer). */
export function avisar(msg, tipo = 'ok', acao = null) {
  const a = $('#aviso');
  a.textContent = msg; a.dataset.tipo = tipo; a.classList.add('mostra');
  if (acao) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'aviso__acao'; b.textContent = acao.rotulo;
    b.onclick = () => { a.classList.remove('mostra'); acao.fn(); };
    a.append(' ', b);
  }
  clearTimeout(avisar.t); avisar.t = setTimeout(() => a.classList.remove('mostra'), acao ? 7000 : 3500);
}

export async function pedir(url, opcoes = {}) {
  const r = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opcoes });
  if (r.status === 401) { location.replace('/admin/entrar?voltar=' + encodeURIComponent(location.pathname)); throw new Error('Faça login.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Não deu para salvar.');
  return d;
}

export const salvarCliente = (dado) => pedir('/api/crm', { method: 'POST', body: JSON.stringify(dado) });
export const anotar = (id, texto, tipo = 'evento') => pedir(`/api/crm/${id}/linha`, { method: 'POST', body: JSON.stringify({ texto, tipo }) });

/* Tarefa gravada antes desta versão tinha estado hoje/semana/backlog. */
export function normalizar(c) {
  for (const a of c.atividades || []) {
    if (!NOMES.estado[a.estado]) a.estado = 'afazer';
    a.prioridade ||= 'normal';
    a.tipo ||= 'tarefa';
    a.checklist ||= [];
    a.etiquetas ||= [];
    a.responsavel ||= '';
  }
  c.projetos ||= []; c.materiais ||= [];
  return c;
}

export async function carregarCrm() {
  const d = await pedir('/api/crm');
  d.clientes.forEach(normalizar);
  return d;
}

// Propostas e formulários do painel. Se algum falhar, vem vazio.
export async function documentos() {
  const ler = (u, k) => fetch(u).then((r) => (r.ok ? r.json() : {})).then((d) => d[k] || []).catch(() => []);
  const [propostas, formularios] = await Promise.all([ler('/api/propostas', 'propostas'), ler('/api/formularios', 'formularios')]);
  return { propostas, formularios };
}

// O nome do cliente no CRM e o da proposta raramente batem letra por letra.
export function mesmoCliente(nomeCrm, outro) {
  const a = String(nomeCrm || '').toLowerCase().trim(), b = String(outro || '').toLowerCase().trim();
  return Boolean(a && b && (a.includes(b) || b.includes(a)));
}

/* ---------- datas ---------- */

export const hojeIso = () => new Date().toLocaleDateString('en-CA');   // AAAA-MM-DD no fuso de quem abre
export const dataCurta = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().slice(0, 2).join('/') : '');
export const dataLonga = (iso) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');
export const diasAte = (iso) => Math.round((new Date(iso.slice(0, 10) + 'T12:00') - new Date(hojeIso() + 'T12:00')) / 864e5);
export const somarDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-CA'); };

export function quando(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 6e4);
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return d < 30 ? `há ${d} dia${d > 1 ? 's' : ''}` : new Date(iso).toLocaleDateString('pt-BR');
}

export function prazoTexto(iso) {
  if (!iso) return 'Sem prazo';
  const d = diasAte(iso);
  if (d === 0) return 'Hoje';
  if (d === 1) return 'Amanhã';
  if (d === -1) return 'Ontem';
  return dataCurta(iso);
}

/* Selo do prazo na lista: texto e tom (atraso, hoje, perto, longe, vazio, feita). */
export function prazoSelo(t) {
  if (t.estado === 'feita') return { txt: 'Feita', tom: 'feita' };
  if (!t.prazo) return { txt: 'Sem prazo', tom: 'vazio' };
  const d = diasAte(t.prazo);
  if (d < 0) return { txt: `Atrasada ${-d} dia${d < -1 ? 's' : ''}`, tom: 'atraso' };
  if (d === 0) return { txt: 'Hoje', tom: 'hoje' };
  if (d === 1) return { txt: 'Amanhã', tom: 'perto' };
  const semana = new Date(t.prazo + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
  return { txt: `${semana[0].toUpperCase()}${semana.slice(1)} ${dataCurta(t.prazo)}`, tom: d <= 7 ? 'perto' : 'longe' };
}

/* ---------- regras de cliente, lead e tarefa ---------- */

// Etiqueta de quem é cliente recorrente com contrato (campo tipo).
export const selo = (c) => (c.tipo === 'recorrente' && c.etapa !== 'encerrado' ? '<span class="crm-selo" title="Cliente ativo, recorrente, com contrato">Recorrente</span>' : '');

/* Link do WhatsApp a partir do telefone do campo contato. Sem código do
   país: +1 se a ficha diz EUA, senão +55. Sem telefone, null.
   ponytail: pega o primeiro telefone do texto; com dois, vale o primeiro. */
export function whatsapp(c) {
  const fone = String(c.contato || '').match(/\+?\d[\d ().-]{7,}\d/);
  if (!fone) return null;
  let n = fone[0].replace(/\D/g, '');
  const eua = /\bEUA\b|\bUSA\b/i.test(`${c.notas || ''} ${c.contato || ''}`);
  if (!fone[0].startsWith('+') && n.length <= 11) n = (eua ? '1' : '55') + n;
  return n.length >= 11 ? `https://wa.me/${n}` : null;
}

export const iniciais = (nome) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const visiveis = (clientes) => clientes.filter((c) => !c.interno);
export const abertas = (c) => (c.atividades || []).filter((a) => a.estado !== 'feita');
export const atrasadas = (c) => abertas(c).filter((a) => a.prazo && a.prazo < hojeIso());
export const proximaEntrega = (c) => abertas(c).filter((a) => a.prazo && a.prazo >= hojeIso()).sort((x, y) => x.prazo.localeCompare(y.prazo))[0] || null;
// A próxima tarefa do cliente: a aberta mais urgente, com prazo mais perto.
export const proximaTarefa = (c) => ordenarTarefas(abertas(c).map((t) => ({ ...t, cliente: c })))[0] || null;

export function diasNaEtapa(c) {
  const desde = c.etapaDesde || [...(c.linha || [])].reverse().find((l) => l.texto.startsWith('Etapa:'))?.data || c.criadoEm;
  return desde ? Math.max(0, -diasAte(desde)) : 0;
}
export const diasSemMovimento = (c) => (c.atualizadoEm ? Math.max(0, -diasAte(c.atualizadoEm)) : 0);

/* Lead pede atenção quando a data de falar de novo chegou, ou quando
   está sem data e sem movimento há DIAS_LEAD_PARADO dias. */
export function situacaoLead(c) {
  if (!LEADS.includes(c.etapa)) return null;
  if (c.proximoContato) {
    const d = diasAte(c.proximoContato);
    if (d < 0) return { chave: 'atrasado', texto: `Follow-up atrasado ${-d} dia${d < -1 ? 's' : ''}`, alerta: true };
    if (d === 0) return { chave: 'hoje', texto: 'Falar hoje', alerta: true };
    return { chave: 'agendado', texto: `Falar ${prazoTexto(c.proximoContato).toLowerCase() === 'amanhã' ? 'amanhã' : 'em ' + dataCurta(c.proximoContato)}` };
  }
  const parado = diasSemMovimento(c);
  if (parado >= DIAS_LEAD_PARADO) return { chave: 'parado', texto: `Parado há ${parado} dias`, alerta: true };
  return { chave: 'semdata', texto: 'Sem data de follow-up' };
}
export const leadPedeAtencao = (c) => Boolean(situacaoLead(c)?.alerta);

export function grupoPrazo(t) {
  if (t.estado === 'feita') return 'feita';
  if (t.estado === 'aguardando') return 'aguardando';
  if (!t.prazo) return 'semprazo';
  const d = diasAte(t.prazo);
  return d < 0 ? 'atrasada' : d === 0 ? 'hoje' : d <= 7 ? 'semana' : 'depois';
}

// Todas as tarefas, cada uma com o cliente junto.
export const todasTarefas = (clientes) => clientes.flatMap((c) => (c.atividades || []).map((t) => ({ ...t, cliente: c })));

export function ordenarTarefas(lista) {
  return lista.sort((a, b) => (a.estado === 'feita') - (b.estado === 'feita')
    || PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade]
    || (a.prazo || '9999').localeCompare(b.prazo || '9999'));
}

/* ---------- lista de tarefas (central e ficha) ---------- */

/* Tarefas do ClickUp no formato das do painel, presas ao cliente do CRM.
   Status muda daqui mesmo; o título leva ao ClickUp. Sem ClickUp ligado, lista vazia. */
export async function tarefasClickup(clientes, renovar = false) {
  try {
    const r = await fetch('/api/clickup' + (renovar ? '?renovar' : ''));
    if (!r.ok) return [];
    return ((await r.json()).tarefas || []).map((t) => ({
      id: 'cu-' + t.id, titulo: t.titulo, estado: t.estado, prazo: t.prazo, prioridade: 'normal', tipo: 'tarefa', checklist: [], etiquetas: [], responsavel: '',
      cliente: clientes.find((c) => mesmoCliente(c.nome, t.cliente)) || { id: '', nome: t.cliente },
      clickup: { id: t.id, url: t.url, status: t.status, lista: t.lista, opcoes: t.opcoes || [], feito: t.feito || '' },
    }));
  } catch { return []; }
}

const opcoes = (nomes, atual) => Object.entries(nomes).map(([k, v]) => `<option value="${k}"${k === atual ? ' selected' : ''}>${v}</option>`).join('');
const opcoesEquipe = (atual) => `<option value="">Ninguém</option>${[...new Set([...EQUIPE, atual].filter(Boolean))].map((n) => `<option${n === atual ? ' selected' : ''}>${esc(n)}</option>`).join('')}`;

/* Etiqueta: a cor sai do nome, então "Folder" tem sempre a mesma cor. */
export function corEtiqueta(nome) {
  let h = 0;
  for (const ch of String(nome).toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) % 997;
  return h % 6;
}
export const chipEtiqueta = (nome) => `<span class="etq" data-cor="${corEtiqueta(nome)}">${esc(nome)}</span>`;

// Cabeçalho das colunas da lista (só na central de tarefas, no computador).
export const cabecalhoTarefas = () => `<li class="tf tf--cab" aria-hidden="true"><span></span><span>Tarefa</span><span>Situação</span><span>Responsável</span><span>Prazo</span><span>Prioridade</span></li>`;

const linhaClickup = (t, mostrarCliente) => {
  const cu = t.clickup, feita = cu.status === cu.feito, p = prazoSelo(t);
  return `<li class="tf tf--clickup" data-cu-id="${esc(cu.id)}" data-feito="${esc(cu.feito)}" data-aberto="${esc(cu.opcoes[0] || '')}" data-feita="${feita ? 1 : 0}">
    <label class="tf__check" title="${feita ? 'Reabrir no ClickUp' : 'Marcar como feita no ClickUp'}"><input type="checkbox" data-cu="feito"${feita ? ' checked' : ''}${cu.feito ? '' : ' disabled'} aria-label="Feita: ${esc(t.titulo)}"></label>
    <a class="tf__corpo" href="${esc(cu.url)}" target="_blank" rel="noopener" title="Abrir no ClickUp">
      <span class="tf__titulo">${esc(t.titulo)}</span>
      <span class="tf__meta"><span class="etq etq--clickup">ClickUp</span>${mostrarCliente ? `<span>${esc(t.cliente.nome)}</span>` : ''}<span>${esc(cu.lista)}</span></span>
    </a>
    <select class="tf__estado tf__estado--clickup" data-cu="status" aria-label="Status no ClickUp">${cu.opcoes.map((o) => `<option${o === cu.status ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>
    <span class="tf__resp"></span>
    <span class="tf__prazo" data-tom="${p.tom}"><span class="tf__selo">${p.txt}</span></span>
    <span class="tf__prio"></span>
  </li>`;
};

/* Mudou o status de uma linha do ClickUp (caixa de feita ou lista de
   status): grava no próprio ClickUp. Vale para toda tela que mostra a linha. */
document.addEventListener('change', async (e) => {
  const campo = e.target.closest('[data-cu]');
  if (!campo) return;
  const li = campo.closest('.tf'), sel = li.querySelector('[data-cu="status"]'), caixa = li.querySelector('[data-cu="feito"]');
  const antes = [...sel.options].find((o) => o.defaultSelected)?.value || sel.value;
  const status = campo === caixa ? (caixa.checked ? li.dataset.feito : li.dataset.aberto) : sel.value;
  li.setAttribute('aria-busy', 'true');
  try {
    await pedir('/api/clickup/' + encodeURIComponent(li.dataset.cuId), { method: 'POST', body: JSON.stringify({ status }) });
    for (const o of sel.options) o.defaultSelected = o.selected = o.value === status;
    caixa.checked = status === li.dataset.feito;
    li.dataset.feita = caixa.checked ? 1 : 0;
    avisar(`No ClickUp: ${status}.`);
  } catch (err) {
    sel.value = antes; caixa.checked = antes === li.dataset.feito;
    avisar(err.message, 'erro');
  } finally { li.removeAttribute('aria-busy'); }
});

/* Uma linha: marcar feita · título com etiquetas e cliente · situação ·
   responsável · prazo · prioridade. Os quatro últimos mudam ali mesmo. */
export function linhaTarefa(t, { mostrarCliente = true } = {}) {
  if (t.clickup) return linhaClickup(t, mostrarCliente);
  const feita = t.estado === 'feita';
  const feitos = t.checklist.filter((i) => i.feito).length;
  const quem = t.cliente.interno ? 'Empresa' : t.cliente.nome;
  const p = prazoSelo(t);
  return `<li class="tf" data-cliente="${t.cliente.id}" data-tarefa="${t.id}" data-feita="${feita ? 1 : 0}" data-prioridade="${t.prioridade}">
    <label class="tf__check" title="${feita ? 'Reabrir' : 'Marcar como feita'}"><input type="checkbox" data-acao="feita"${feita ? ' checked' : ''} aria-label="Feita: ${esc(t.titulo)}"></label>
    <button class="tf__corpo" type="button" data-acao="abrir">
      <span class="tf__titulo">${t.tipo === 'entrega' ? '<span class="tf__entrega">Entrega</span>' : ''}${esc(t.titulo)}</span>
      <span class="tf__meta">
        ${t.etiquetas.map(chipEtiqueta).join('')}
        ${mostrarCliente ? `<span class="tf__cliente">${esc(quem)}</span>` : ''}
        ${t.checklist.length ? `<span>${feitos}/${t.checklist.length} itens</span>` : ''}
        ${t.claude && t.claude !== 'feita' ? `<span class="tf__claude" data-claude="${t.claude}">${NOMES.claude[t.claude]}</span>` : ''}
      </span>
    </button>
    <select class="tf__estado" data-campo="estado" data-valor="${t.estado}" aria-label="Situação">${opcoes(NOMES.estado, t.estado)}</select>
    <select class="tf__resp" data-campo="responsavel" aria-label="Responsável">${opcoesEquipe(t.responsavel)}</select>
    <label class="tf__prazo" data-tom="${p.tom}" title="Mudar o prazo"><span class="tf__selo">${p.txt}</span><input type="date" data-campo="prazo" value="${t.prazo || ''}" aria-label="Prazo"></label>
    <select class="tf__prio" data-campo="prioridade" data-valor="${t.prioridade}" aria-label="Prioridade">${opcoes(NOMES.prioridade, t.prioridade)}</select>
  </li>`;
}

/* Liga os cliques de uma lista de tarefas. `achar(clienteId)` devolve o
   cliente atual; `aoSalvar(cliente)` recebe o cliente gravado. */
export function ligarLista(raiz, { achar, aoSalvar, clientes }) {
  const daLinha = (el) => {
    const li = el.closest('.tf[data-tarefa]');
    const c = li && achar(li.dataset.cliente);
    return { li, c, t: c?.atividades.find((x) => x.id === li.dataset.tarefa) };
  };
  raiz.addEventListener('click', (e) => {
    const prazo = e.target.closest('.tf__prazo');
    if (prazo && !e.target.matches('input')) {
      e.preventDefault();
      try { prazo.querySelector('input')?.showPicker(); } catch { prazo.querySelector('input')?.focus(); }
      return;
    }
    if (!e.target.closest('[data-acao="abrir"]')) return;
    const { c, t } = daLinha(e.target);
    if (t) abrirTarefa({ cliente: c, tarefa: t, clientes: clientes(), aoSalvar });
  });
  raiz.addEventListener('change', async (e) => {
    const campo = e.target.dataset.campo || (e.target.dataset.acao === 'feita' && 'estado');
    if (!campo) return;
    const { c, t } = daLinha(e.target);
    if (!t) return;
    const valor = e.target.dataset.acao === 'feita' ? (e.target.checked ? 'feita' : 'afazer') : e.target.value;
    const antes = t[campo];
    try {
      aoSalvar(await salvarTarefa(c, { id: t.id, [campo]: valor }));
      if (campo === 'estado' && valor === 'feita') {
        avisar(`Feita: ${t.titulo}`, 'ok', { rotulo: 'Desfazer', fn: async () => aoSalvar(await salvarTarefa(c, { id: t.id, estado: antes })) });
      }
    } catch (err) { avisar(err.message, 'erro'); aoSalvar(c); }
  });
}

// Grava uma tarefa só (o servidor mistura os campos enviados). Devolve o cliente.
export function salvarTarefa(c, tarefa) {
  const { cliente, ...limpa } = tarefa;   // o cliente só viaja na tela, não no arquivo
  return pedir(`/api/crm/${c.id}/tarefa`, { method: 'POST', body: JSON.stringify(limpa) }).then(normalizar);
}

const novoIdTarefa = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, '0')).join('');
export const todasEtiquetas = (clientes) => [...new Set(clientes.flatMap((c) => (c.atividades || []).flatMap((a) => a.etiquetas || [])))].sort((a, b) => a.localeCompare(b));

/* Tarefa sem cliente fica no registro interno. Nasce na primeira vez. */
export async function registroInterno(clientes) {
  const achado = clientes.find((c) => c.interno);
  if (achado) return achado;
  return normalizar(await salvarCliente({ nome: 'Empresa (tarefas internas)', interno: true, etapa: 'andamento' }));
}

/* ---------- painel da tarefa (lateral, grava sozinho) ---------- */

function janelaTarefa() {
  let d = $('#jan-tarefa');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'jan-tarefa';
  d.className = 'lateral';
  d.setAttribute('aria-labelledby', 'jt-titulo');
  const prop = (icone, nome, campo, classe = '') => `<label class="jt-prop ${classe}"><span class="jt-prop__nome">${ico(icone).outerHTML}${nome}</span>${campo}</label>`;
  d.innerHTML = `
    <header class="modal__topo"><b id="jt-titulo">Tarefa</b>
      <span class="jt-salvo" id="jt-salvo" role="status"></span>
      <button class="mini" type="button" id="jt-copiar" title="Copia o pedido completo para colar numa conversa do Claude Code">Copiar pedido</button>
      <button class="mini mini--ativo" type="button" data-fechar>Fechar</button></header>
    <div class="modal__corpo">
      <form id="jt-form" class="jt">
        <a class="jt-cliente" id="jt-cliente" target="_blank" rel="noopener"></a>
        <textarea class="jt-nome" name="titulo" rows="1" maxlength="300" placeholder="O que fazer" aria-label="O que fazer"></textarea>
        <div class="jt-props">
          ${prop('clientes', 'Cliente', '<select name="cliente"></select>', 'jt-prop--cliente')}
          ${prop('situacao', 'Situação', `<select name="estado">${opcoes(NOMES.estado)}</select>`)}
          ${prop('clientes', 'Responsável', '<select name="responsavel"></select>')}
          ${prop('calendario', 'Prazo', '<input type="date" name="prazo">')}
          ${prop('bandeira', 'Prioridade', `<select name="prioridade">${opcoes(NOMES.prioridade)}</select>`)}
          ${prop('modelo', 'Tipo', '<select name="tipo"><option value="tarefa">Tarefa</option><option value="entrega">Entrega para o cliente</option></select>')}
          <div class="jt-prop jt-prop--etq"><span class="jt-prop__nome">${ico('elo').outerHTML}Etiquetas</span>
            <div class="jt-etqs"><span id="jt-etqs"></span><input type="text" id="jt-nova-etq" list="jt-lista-etq" maxlength="30" placeholder="+ etiqueta" aria-label="Nova etiqueta"><datalist id="jt-lista-etq"></datalist></div></div>
        </div>
        <section class="jt-secao jt-secao--claude" id="jt-claude"></section>
        <section class="jt-secao">
          <h3 class="jt-secao__h">${ico('nota').outerHTML}Detalhes</h3>
          <textarea name="descricao" rows="4" maxlength="4000" placeholder="O que precisa saber para fazer" aria-label="Detalhes"></textarea>
        </section>
        <section class="jt-secao">
          <h3 class="jt-secao__h">${ico('tarefas').outerHTML}Checklist <small id="jt-conta"></small></h3>
          <div class="jt-barra" hidden><i id="jt-barra"></i></div>
          <ul id="jt-itens"></ul>
          <div class="fc-add"><input type="text" id="jt-novo-item" placeholder="Novo item (Enter adiciona)" maxlength="300" aria-label="Novo item do checklist"></div>
        </section>
        <p class="jt-rodape" id="jt-rodape"></p>
      </form>
    </div>`;
  document.body.append(d);
  $('[data-fechar]', d).onclick = () => d.close();
  return d;
}

/* Abre o painel. Sem `tarefa`, cria. Sem `cliente`, mostra o seletor.
   Toda mudança grava sozinha; fechar (botão, Esc ou clique fora) grava o
   que faltar. Só vão os campos que mudaram, para não desfazer o que outra
   pessoa mudou na mesma tarefa. */
export function abrirTarefa({ cliente = null, tarefa = null, clientes = [], aoSalvar, prazo = '' }) {
  const d = janelaTarefa();
  const f = $('#jt-form', d);
  const t = structuredClone(tarefa || { id: novoIdTarefa(), titulo: '', prazo, prioridade: 'normal', estado: 'afazer', tipo: 'tarefa', descricao: '', checklist: [], etiquetas: [], responsavel: '', claude: '', origem: 'painel' });
  delete t.cliente;
  let dono = cliente, criada = Boolean(tarefa), sujos = new Set(), timer = null, gravando = Promise.resolve();
  $('#jt-titulo', d).textContent = tarefa ? 'Tarefa' : 'Nova tarefa';

  const salvo = (txt) => { $('#jt-salvo', d).textContent = txt; };
  salvo(tarefa ? '' : 'Escreva o que fazer');

  // Cliente: escolhe só ao criar; depois vira link para a ficha.
  const opcoesCli = visiveis(clientes).filter((c) => c.etapa !== 'encerrado').sort((a, b) => a.nome.localeCompare(b.nome));
  f.elements.cliente.innerHTML = '<option value="">Sem cliente (tarefa da empresa)</option>' + opcoesCli.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  const mostrarCliente = () => {
    $('.jt-prop--cliente', d).hidden = Boolean(dono);
    const link = $('#jt-cliente', d);
    link.hidden = !dono;
    if (dono) { link.textContent = dono.interno ? 'Tarefa da empresa' : dono.nome; link.href = dono.interno ? '/admin/crm/#tarefas' : `/admin/crm/cliente/#${dono.id}`; }
  };
  mostrarCliente();

  f.elements.responsavel.innerHTML = opcoesEquipe(t.responsavel);
  for (const k of ['titulo', 'prazo', 'prioridade', 'estado', 'tipo', 'descricao', 'responsavel']) f.elements[k].value = t[k] || '';
  const pintar = () => { for (const k of ['estado', 'prioridade']) f.elements[k].dataset.valor = f.elements[k].value; };
  pintar();

  /* ---- gravar ---- */
  const gravar = () => {
    clearTimeout(timer);
    if (!sujos.size) return gravando;
    if (!t.titulo.trim()) { salvo('Escreva o que fazer para salvar'); return gravando; }
    const campos = criada ? [...sujos] : Object.keys(t);
    sujos = new Set();
    const envio = { id: t.id, ...Object.fromEntries(campos.map((k) => [k, t[k]])) };
    salvo('Salvando…');
    gravando = gravando.then(async () => {
      if (!dono) dono = clientes.find((c) => c.id === f.elements.cliente.value) || await registroInterno(clientes);
      const c = await salvarTarefa(dono, envio);
      dono = c; criada = true;
      mostrarCliente();
      aoSalvar(c);
      salvo('Salvo');
    }).catch((err) => { campos.forEach((k) => sujos.add(k)); salvo('Não salvou'); avisar(err.message, 'erro'); });
    return gravando;
  };
  const mudou = (k) => { sujos.add(k); salvo('Editando…'); clearTimeout(timer); timer = setTimeout(gravar, SALVAR_DEPOIS_MS); };

  f.oninput = f.onchange = (e) => {
    const k = e.target.name;
    if (!k || k === 'cliente') return;
    t[k] = e.target.value;
    if (k === 'estado' || k === 'prioridade') pintar();
    mudou(k);
  };
  f.onsubmit = (e) => { e.preventDefault(); gravar(); };

  // O título cresce com o texto; Enter grava em vez de quebrar linha.
  const nome = f.elements.titulo;
  const crescer = () => { nome.style.height = 'auto'; nome.style.height = nome.scrollHeight + 'px'; };
  nome.addEventListener('input', crescer);
  nome.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); gravar(); } };

  /* ---- etiquetas ---- */
  $('#jt-lista-etq', d).innerHTML = todasEtiquetas(clientes).map((x) => `<option value="${esc(x)}">`).join('');
  const desenharEtqs = () => {
    $('#jt-etqs', d).innerHTML = t.etiquetas.map((x, n) => `<span class="etq" data-cor="${corEtiqueta(x)}">${esc(x)}<button type="button" data-tirar-etq="${n}" aria-label="Tirar a etiqueta ${esc(x)}">×</button></span>`).join('');
  };
  desenharEtqs();
  const novaEtq = $('#jt-nova-etq', d);
  const addEtq = () => {
    const v = novaEtq.value.replace(/,/g, '').trim();
    novaEtq.value = '';
    if (!v || t.etiquetas.some((x) => x.toLowerCase() === v.toLowerCase()) || t.etiquetas.length >= 8) return;
    t.etiquetas = [...t.etiquetas, v];
    desenharEtqs(); mudou('etiquetas');
  };
  novaEtq.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addEtq(); } };
  novaEtq.onchange = (e) => { e.stopPropagation(); if ([...$('#jt-lista-etq', d).options].some((o) => o.value === novaEtq.value)) addEtq(); };
  novaEtq.oninput = (e) => e.stopPropagation();
  novaEtq.onblur = addEtq;
  $('#jt-etqs', d).onclick = (e) => {
    const b = e.target.closest('[data-tirar-etq]');
    if (!b) return;
    t.etiquetas = t.etiquetas.filter((_, n) => n !== +b.dataset.tirarEtq);
    desenharEtqs(); mudou('etiquetas');
  };

  /* ---- checklist ---- */
  const contar = () => {
    const feitos = t.checklist.filter((i) => i.feito).length, total = t.checklist.length;
    $('#jt-conta', d).textContent = total ? `${feitos} de ${total}` : '';
    $('.jt-barra', d).hidden = !total;
    $('#jt-barra', d).style.width = total ? `${(feitos / total) * 100}%` : '0';
  };
  const desenharItens = () => {
    $('#jt-itens', d).innerHTML = t.checklist.map((i, n) => `<li><label><input type="checkbox" data-n="${n}"${i.feito ? ' checked' : ''}> <span>${esc(i.texto)}</span></label><button type="button" class="jt-tirar" data-tirar-item="${n}" aria-label="Tirar o item">×</button></li>`).join('');
    contar();
  };
  desenharItens();
  $('#jt-itens', d).onchange = (e) => {
    e.stopPropagation();
    const n = e.target.dataset.n;
    if (n === undefined) return;
    t.checklist = t.checklist.map((i, k) => (k === +n ? { ...i, feito: e.target.checked } : i));
    contar(); mudou('checklist');
  };
  $('#jt-itens', d).onclick = (e) => {
    const b = e.target.closest('[data-tirar-item]');
    if (!b) return;
    t.checklist = t.checklist.filter((_, k) => k !== +b.dataset.tirarItem);
    desenharItens(); mudou('checklist');
  };
  const novoItem = $('#jt-novo-item', d);
  novoItem.oninput = novoItem.onchange = (e) => e.stopPropagation();
  novoItem.onkeydown = (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const v = novoItem.value.trim();
    if (!v) return;
    t.checklist = [...t.checklist, { texto: v, feito: false }];
    novoItem.value = '';
    desenharItens(); mudou('checklist');
  };

  /* ---- Claude ---- */
  const desenharClaude = () => {
    const estado = t.claude || '';
    const texto = {
      '': `O Claude do seu Mac olha a fila a cada ${MINUTOS_FILA_CLAUDE} minutos, faz a tarefa e deixa uma nota aqui. Mensagem para cliente ele só deixa pronta, nunca envia.`,
      fila: `Na fila. O Claude começa em até ${MINUTOS_FILA_CLAUDE} minutos (o Mac precisa estar ligado com o app do Claude aberto).`,
      trabalhando: 'O Claude está fazendo esta tarefa agora.',
      precisa: 'O Claude parou e precisa de você. Veja a nota abaixo, responda nos detalhes e mande de novo.',
      feita: 'O Claude terminou. Confira a nota abaixo.',
    }[estado];
    const botao = estado === 'fila' ? '<button class="mini" type="button" data-claude="">Tirar da fila</button>'
      : estado === 'trabalhando' ? ''
      : `<button class="btn btn--brand btn--peq" type="button" data-claude="fila">${ico('ia').outerHTML}${estado ? 'Mandar o Claude de novo' : 'Mandar o Claude fazer'}</button>`;
    $('#jt-claude', d).dataset.estado = estado;
    $('#jt-claude', d).innerHTML = `<h3 class="jt-secao__h">${ico('ia').outerHTML}Claude${estado ? ` <small>${NOMES.claude[estado]}</small>` : ''}</h3>
      <p class="jt-claude__txt">${texto}</p>${botao}
      ${t.notaClaude ? `<p class="jt-nota-claude">${esc(t.notaClaude)}</p>` : ''}`;
  };
  desenharClaude();
  $('#jt-claude', d).onclick = (e) => {
    const b = e.target.closest('[data-claude]');
    if (!b) return;
    t.claude = b.dataset.claude;
    desenharClaude(); sujos.add('claude'); gravar();
    if (t.claude === 'fila') avisar(`Na fila do Claude. Ele começa em até ${MINUTOS_FILA_CLAUDE} minutos.`);
  };
  $('#jt-copiar', d).onclick = () => copiar(pedidoClaude(t, dono || { interno: true, materiais: [] }), 'Pedido copiado. Cole numa conversa do Claude Code.');

  $('#jt-rodape', d).textContent = tarefa
    ? [t.criadaEm && `Criada em ${dataLonga(t.criadaEm)}`, t.atualizadaEm && `mudou ${quando(t.atualizadaEm)}`, t.concluidaEm && `feita em ${dataLonga(t.concluidaEm)}`].filter(Boolean).join(' · ')
    : '';

  // Fechou de qualquer jeito: grava o que faltar.
  d.onclose = () => { gravar(); };
  d.showModal();
  requestAnimationFrame(crescer);
  if (!tarefa) nome.focus();
}

/* ---------- Claude Code ---------- */

export function pedidoClaude(t, c) {
  const linhas = [
    `Tarefa do CRM (links.samuelfreire.com.br/admin/crm):`,
    `Cliente: ${c.interno ? 'tarefa interna da empresa' : c.nome}${c.servico ? ` (${c.servico})` : ''}`,
    `Tarefa: ${t.titulo}`,
    t.descricao && `Detalhes: ${t.descricao}`,
    t.prazo && `Prazo: ${dataLonga(t.prazo)}`,
    `Prioridade: ${NOMES.prioridade[t.prioridade]}`,
    t.checklist.length && `Checklist:\n${t.checklist.map((i) => `- [${i.feito ? 'x' : ' '}] ${i.texto}`).join('\n')}`,
    !c.interno && c.drive && `Pasta de materiais no Drive: ${c.drive}`,
    !c.interno && c.materiais.some((m) => m.estado === 'falta') && `Materiais que ainda faltam: ${c.materiais.filter((m) => m.estado === 'falta').map((m) => m.nome).join(', ')}`,
    !c.interno && `Pasta do projeto: procure em ${PASTA_PROJETOS}/ pelo nome do cliente.`,
    '',
    `Ids no CRM: cliente ${c.id}, tarefa ${t.id}. Ao começar, marque claude "trabalhando"; ao terminar, claude "feita" com uma nota do que foi feito (notaClaude); se travar, claude "precisa" com a pergunta na nota.`,
  ];
  return linhas.filter((l) => typeof l === 'string').join('\n');
}

export async function copiar(texto, msg = 'Copiado.') {
  try { await navigator.clipboard.writeText(texto); avisar(msg); }
  catch (e) { prompt('Copie o texto abaixo:', texto); }
}

/* ---------- busca rápida: Ctrl/Cmd+K ou "/" ---------- */

export function ligarBusca(clientes) {
  let d = $('#jan-busca');
  if (!d) {
    d = document.createElement('dialog');
    d.id = 'jan-busca';
    d.className = 'busca';
    d.setAttribute('aria-label', 'Busca rápida');
    d.innerHTML = `<input type="search" id="busca-rapida" placeholder="Buscar cliente, lead ou tarefa" autocomplete="off" aria-label="Buscar">
      <ul id="busca-res" role="listbox"></ul><p class="busca__dica">Enter abre · Esc fecha</p>`;
    document.body.append(d);
    d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  }
  const res = $('#busca-res', d), campo = $('#busca-rapida', d);
  const resultados = (q) => {
    q = q.trim().toLowerCase();
    if (!q) return [];
    const lista = clientes();
    const cs = visiveis(lista).filter((c) => c.nome.toLowerCase().includes(q) || (c.servico || '').toLowerCase().includes(q))
      .map((c) => ({ href: `/admin/crm/cliente/#${c.id}`, txt: c.nome, apoio: LEADS.includes(c.etapa) ? 'Lead' : 'Cliente' }));
    const ts = todasTarefas(lista).filter((t) => t.estado !== 'feita' && t.titulo.toLowerCase().includes(q))
      .map((t) => ({ href: t.cliente.interno ? '/admin/crm/#tarefas' : `/admin/crm/cliente/#${t.cliente.id}&tarefas`, txt: t.titulo, apoio: `Tarefa · ${t.cliente.interno ? 'Empresa' : t.cliente.nome}` }));
    return [...cs, ...ts].slice(0, 12);
  };
  campo.oninput = () => {
    res.innerHTML = resultados(campo.value).map((r, i) => `<li><a href="${r.href}"${i === 0 ? ' class="ativo"' : ''}><b>${esc(r.txt)}</b><small>${esc(r.apoio)}</small></a></li>`).join('')
      || (campo.value.trim() ? '<li class="vazio">Nada encontrado.</li>' : '');
  };
  campo.onkeydown = (e) => {
    const itens = $$('a', res);
    let i = itens.findIndex((a) => a.classList.contains('ativo'));
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      itens[i]?.classList.remove('ativo');
      i = (i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length;
      itens[i]?.classList.add('ativo');
    }
    if (e.key === 'Enter' && itens[i]) { e.preventDefault(); location.href = itens[i].href; d.close(); }
  };
  const abrir = () => { campo.value = ''; res.innerHTML = ''; d.showModal(); campo.focus(); };
  addEventListener('keydown', (e) => {
    const digitando = /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName);
    if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !digitando && !document.querySelector('dialog[open]'))) { e.preventDefault(); abrir(); }
  });
  return abrir;
}
