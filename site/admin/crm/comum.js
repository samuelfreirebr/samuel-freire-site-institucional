/* Peças que as telas do CRM e a ficha do cliente usam igual: textos,
   datas, a lista de tarefas, o editor de tarefa, a busca rápida
   (Ctrl/Cmd+K) e o pedido pronto para o Claude Code. */

/* ---------- Central de ajustes ---------- */
export const DIAS_LEAD_PARADO = 7;     // lead sem movimento há este tanto de dias vira "parado"
export const DIAS_PROXIMAS = 14;       // janela das "próximas entregas"
const PASTA_PROJETOS = 'Meu Drive/PROJETOS : PORTFÓLIO';   // vai no pedido para o Claude

export const $ = (s, raiz = document) => raiz.querySelector(s);
export const $$ = (s, raiz = document) => [...raiz.querySelectorAll(s)];
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const NOMES = {
  estado: { afazer: 'A fazer', andamento: 'Fazendo', aguardando: 'Aguardando', feita: 'Feita' },
  prioridade: { urgente: 'Urgente', alta: 'Alta', normal: 'Normal', baixa: 'Baixa' },
  origem: { whatsapp: 'WhatsApp', instagram: 'Instagram', indicacao: 'Indicação', prospeccao: 'Prospecção', site: 'Site', outro: 'Outro' },
  claude: { fila: 'Na fila do Claude', trabalhando: 'Claude trabalhando', feita: 'Feita pelo Claude' },
  grupo: { atrasada: 'Atrasadas', hoje: 'Hoje', semana: 'Próximos 7 dias', depois: 'Depois', semprazo: 'Sem prazo', aguardando: 'Aguardando alguém', feita: 'Feitas' },
};
export const LEADS = ['lead', 'proposta', 'followup', 'assinatura']; // ainda não fechou: contrato assinado ou pago vira cliente
const PESO_PRIORIDADE = { urgente: 0, alta: 1, normal: 2, baixa: 3 };

/* ---------- avisos e API ---------- */

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

export const salvarCliente = (dado) => pedir('/api/crm', { method: 'POST', body: JSON.stringify(dado) });
export const anotar = (id, texto, tipo = 'evento') => pedir(`/api/crm/${id}/linha`, { method: 'POST', body: JSON.stringify({ texto, tipo }) });

/* Tarefa gravada antes desta versão tinha estado hoje/semana/backlog. */
export function normalizar(c) {
  for (const a of c.atividades || []) {
    if (!NOMES.estado[a.estado]) a.estado = 'afazer';
    a.prioridade ||= 'normal';
    a.tipo ||= 'tarefa';
    a.checklist ||= [];
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
   Só leitura: a linha leva ao ClickUp. Sem ClickUp ligado, lista vazia. */
export async function tarefasClickup(clientes, renovar = false) {
  try {
    const r = await fetch('/api/clickup' + (renovar ? '?renovar' : ''));
    if (!r.ok) return [];
    return ((await r.json()).tarefas || []).map((t) => ({
      id: 'cu-' + t.id, titulo: t.titulo, estado: t.estado, prazo: t.prazo, prioridade: 'normal', tipo: 'tarefa', checklist: [],
      cliente: clientes.find((c) => mesmoCliente(c.nome, t.cliente)) || { id: '', nome: t.cliente },
      clickup: { id: t.id, url: t.url, status: t.status, lista: t.lista, opcoes: t.opcoes || [], feito: t.feito || '' },
    }));
  } catch { return []; }
}

const linhaClickup = (t, mostrarCliente) => {
  const cu = t.clickup, feita = cu.status === cu.feito;
  return `<li class="tf tf--clickup" data-cu-id="${esc(cu.id)}" data-feito="${esc(cu.feito)}" data-aberto="${esc(cu.opcoes[0] || '')}" data-feita="${feita ? 1 : 0}">
    <label class="tf__check" title="${feita ? 'Reabrir no ClickUp' : 'Marcar como feita no ClickUp'}"><input type="checkbox" data-cu="feito"${feita ? ' checked' : ''}${cu.feito ? '' : ' disabled'} aria-label="Feita: ${esc(t.titulo)}"></label>
    <a class="tf__corpo" href="${esc(cu.url)}" target="_blank" rel="noopener" title="Abrir no ClickUp">
      <span class="tf__titulo">${esc(t.titulo)}</span>
      <span class="tf__meta">${mostrarCliente ? `<span>${esc(t.cliente.nome)}</span>` : ''}<span>${esc(cu.lista)}</span><span>ClickUp</span></span>
    </a>
    <select class="tf__status" data-cu="status" aria-label="Status no ClickUp">${cu.opcoes.map((o) => `<option${o === cu.status ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>
    <span class="tf__prazo${t.estado !== 'feita' && t.prazo && t.prazo < hojeIso() ? ' atraso' : ''}">${prazoTexto(t.prazo)}</span>
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

export function linhaTarefa(t, { mostrarCliente = true } = {}) {
  if (t.clickup) return linhaClickup(t, mostrarCliente);
  const feita = t.estado === 'feita';
  const atraso = !feita && t.prazo && t.prazo < hojeIso();
  const feitos = t.checklist.filter((i) => i.feito).length;
  const quem = t.cliente.interno ? 'Empresa' : t.cliente.nome;
  return `<li class="tf" data-cliente="${t.cliente.id}" data-tarefa="${t.id}" data-feita="${feita ? 1 : 0}">
    <label class="tf__check" title="${feita ? 'Reabrir' : 'Marcar como feita'}"><input type="checkbox" data-acao="feita"${feita ? ' checked' : ''} aria-label="Feita: ${esc(t.titulo)}"></label>
    <button class="tf__corpo" type="button" data-acao="abrir">
      <span class="tf__titulo">${t.tipo === 'entrega' ? '<span class="tf__entrega">Entrega</span>' : ''}${esc(t.titulo)}</span>
      <span class="tf__meta">
        ${mostrarCliente ? `<span>${esc(quem)}</span>` : ''}
        ${t.checklist.length ? `<span>${feitos}/${t.checklist.length} itens</span>` : ''}
        ${t.estado === 'andamento' ? '<span>Fazendo</span>' : ''}
        ${t.claude ? `<span class="claude">${NOMES.claude[t.claude]}</span>` : t.origem === 'claude' ? '<span class="claude">Criada pelo Claude</span>' : ''}
      </span>
    </button>
    <span class="tf__prio" data-prioridade="${t.prioridade}">${NOMES.prioridade[t.prioridade]}</span>
    <span class="tf__prazo${atraso ? ' atraso' : ''}">${feita ? 'Feita' : prazoTexto(t.prazo)}</span>
    <span class="tf__acoes">
      ${feita ? '' : `<button class="mini" type="button" data-acao="claude" title="Põe na fila: o Claude pega quando você pedir">${t.claude === 'fila' ? 'Na fila' : 'Enviar ao Claude'}</button>
      <button class="mini" type="button" data-acao="copiar" title="Copia o pedido completo para colar no Claude Code">Copiar pedido</button>`}
    </span>
  </li>`;
}

/* Liga os cliques de uma lista de tarefas. `achar(clienteId)` devolve o
   cliente atual; `aoSalvar(cliente)` recebe o cliente gravado. */
export function ligarLista(raiz, { achar, aoSalvar, clientes }) {
  raiz.addEventListener('click', async (e) => {
    const alvo = e.target.closest('[data-acao]');
    const li = e.target.closest('.tf');
    if (!alvo || !li) return;
    const c = achar(li.dataset.cliente);
    const t = c?.atividades.find((x) => x.id === li.dataset.tarefa);
    if (!t) return;
    const acao = alvo.dataset.acao;
    if (acao === 'abrir') return abrirTarefa({ cliente: c, tarefa: t, clientes: clientes(), aoSalvar });
    if (acao === 'copiar') return copiar(pedidoClaude(t, c), 'Pedido copiado. Cole numa conversa nova do Claude Code.');
    if (acao === 'claude') {
      const novo = t.claude === 'fila' ? '' : 'fila';
      try {
        aoSalvar(await salvarTarefa(c, { ...t, claude: novo }));
        avisar(novo ? 'Na fila do Claude. Peça a ele: "pega a fila do CRM".' : 'Saiu da fila do Claude.');
      } catch (err) { avisar(err.message, 'erro'); }
    }
  });
  raiz.addEventListener('change', async (e) => {
    if (e.target.dataset.acao !== 'feita') return;
    const li = e.target.closest('.tf');
    const c = achar(li.dataset.cliente);
    const t = c?.atividades.find((x) => x.id === li.dataset.tarefa);
    if (!t) return;
    try { aoSalvar(await salvarTarefa(c, { ...t, estado: e.target.checked ? 'feita' : 'afazer' })); }
    catch (err) { avisar(err.message, 'erro'); e.target.checked = !e.target.checked; }
  });
}

export function salvarTarefa(c, tarefa) {
  const atividades = structuredClone(c.atividades || []);
  const i = atividades.findIndex((a) => a.id === tarefa.id);
  const { cliente, ...limpa } = tarefa;   // o cliente só viaja na tela, não no arquivo
  if (i >= 0) atividades[i] = limpa; else atividades.push(limpa);
  return salvarCliente({ id: c.id, atividades }).then(normalizar);
}

/* Tarefa sem cliente fica no registro interno. Nasce na primeira vez. */
export async function registroInterno(clientes) {
  const achado = clientes.find((c) => c.interno);
  if (achado) return achado;
  return normalizar(await salvarCliente({ nome: 'Empresa (tarefas internas)', interno: true, etapa: 'andamento' }));
}

/* ---------- editor de tarefa (janela) ---------- */

function janelaTarefa() {
  let d = $('#jan-tarefa');
  if (d) return d;
  d = document.createElement('dialog');
  d.id = 'jan-tarefa';
  d.setAttribute('aria-labelledby', 'jt-titulo');
  d.innerHTML = `
    <header class="modal__topo"><b id="jt-titulo">Tarefa</b>
      <button class="mini mini--ativo" type="submit" form="jt-form">Salvar</button>
      <button class="mini" type="button" data-fechar>Fechar</button></header>
    <div class="modal__corpo">
      <form id="jt-form">
        <label><span>O que fazer</span><input type="text" name="titulo" required maxlength="300"></label>
        <label id="jt-cliente-campo"><span>Cliente</span><select name="cliente"></select></label>
        <div class="linha linha--3">
          <label><span>Prazo</span><input type="date" name="prazo"></label>
          <label><span>Prioridade</span><select name="prioridade">${Object.entries(NOMES.prioridade).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
          <label><span>Situação</span><select name="estado">${Object.entries(NOMES.estado).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
        </div>
        <label><span>Tipo</span><select name="tipo"><option value="tarefa">Tarefa</option><option value="entrega">Entrega para o cliente</option></select></label>
        <label><span>Detalhes</span><textarea name="descricao" rows="3" maxlength="4000" placeholder="O que precisa saber para fazer"></textarea></label>
        <div class="jt-check">
          <span class="jt-rotulo">Checklist</span>
          <ul id="jt-itens"></ul>
          <div class="fc-add"><input type="text" id="jt-novo-item" placeholder="Novo item" maxlength="300" aria-label="Novo item do checklist"><button class="mini" type="button" id="jt-add-item">Adicionar item</button></div>
        </div>
        <label><span>Claude</span><select name="claude"><option value="">Fora da fila</option>${Object.entries(NOMES.claude).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>
          <small>"Na fila" quer dizer: quando você pedir "pega a fila do CRM", o Claude começa por esta.</small></label>
        <p class="jt-nota-claude" id="jt-nota-claude" hidden></p>
      </form>
    </div>`;
  document.body.append(d);
  $('[data-fechar]', d).onclick = () => d.close();
  return d;
}

/* Abre o editor. Sem `tarefa`, cria. Sem `cliente`, mostra o seletor. */
export function abrirTarefa({ cliente = null, tarefa = null, clientes = [], aoSalvar, prazo = '' }) {
  const d = janelaTarefa();
  const f = $('#jt-form', d);
  const t = structuredClone(tarefa || { titulo: '', prazo, prioridade: 'normal', estado: 'afazer', tipo: 'tarefa', descricao: '', checklist: [], claude: '', origem: 'painel' });
  delete t.cliente;
  $('#jt-titulo', d).textContent = tarefa ? 'Editar tarefa' : 'Nova tarefa';

  const opcoes = visiveis(clientes).filter((c) => c.etapa !== 'encerrado');
  $('#jt-cliente-campo', d).hidden = Boolean(tarefa || cliente);
  f.elements.cliente.innerHTML = '<option value="">Sem cliente (tarefa da empresa)</option>'
    + opcoes.sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');

  const atual = () => cliente || clientes.find((c) => c.id === f.elements.cliente.value) || null;

  for (const k of ['titulo', 'prazo', 'prioridade', 'estado', 'tipo', 'descricao', 'claude']) f.elements[k].value = t[k] || '';
  const nota = $('#jt-nota-claude', d);
  nota.hidden = !t.notaClaude;
  nota.textContent = t.notaClaude ? `Nota do Claude: ${t.notaClaude}` : '';

  const desenharItens = () => {
    $('#jt-itens', d).innerHTML = t.checklist.map((i, n) => `<li><label><input type="checkbox" data-n="${n}"${i.feito ? ' checked' : ''}> <span>${esc(i.texto)}</span></label></li>`).join('');
  };
  desenharItens();
  $('#jt-itens', d).onchange = (e) => { const n = e.target.dataset.n; if (n !== undefined) t.checklist[n].feito = e.target.checked; };
  const addItem = () => {
    const v = $('#jt-novo-item', d).value.trim();
    if (!v) return;
    t.checklist.push({ texto: v, feito: false });
    $('#jt-novo-item', d).value = '';
    desenharItens();
  };
  $('#jt-add-item', d).onclick = addItem;
  $('#jt-novo-item', d).onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } };

  f.onsubmit = async (e) => {
    e.preventDefault();
    for (const k of ['titulo', 'prazo', 'prioridade', 'estado', 'tipo', 'descricao', 'claude']) t[k] = f.elements[k].value;
    try {
      const dono = atual() || await registroInterno(clientes);
      aoSalvar(await salvarTarefa(dono, t));
      d.close();
      avisar(tarefa ? 'Tarefa salva.' : 'Tarefa criada.');
    } catch (err) { avisar(err.message, 'erro'); }
  };
  d.showModal();
  f.elements.titulo.focus();
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
    `Ids no CRM: cliente ${c.id}, tarefa ${t.id}. Ao começar, marque a tarefa como "trabalhando" no CRM; ao terminar, como "feita", com uma nota do que foi feito.`,
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
