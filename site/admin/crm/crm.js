/* CRM: hub de atividades. Visão geral (o que pede atenção hoje),
   Tarefas (central agrupada, com visões salvas), Calendário, Leads
   (follow-up) e Clientes (tabela com prévia lateral, ou funil).
   A ficha de cada cliente mora em /admin/crm/cliente/#id. O Claude
   grava pela mesma API, com a chave dele. Nada de financeiro aqui. */

import {
  $, $$, esc, avisar, salvarCliente, anotar, carregarCrm, normalizar, NOMES, LEADS, DIAS_PROXIMAS,
  hojeIso, dataCurta, diasAte, quando, prazoTexto, somarDias, iniciais, visiveis, abertas, atrasadas,
  proximaEntrega, projetoAtual, diasNaEtapa, diasSemMovimento, situacaoLead, leadPedeAtencao,
  grupoPrazo, todasTarefas, ordenarTarefas, linhaTarefa, ligarLista, abrirTarefa, ligarBusca,
} from './comum.js';
import { boasVindas, barrasRitmo, ritmo, roscaPrioridade, faixaPrazos } from './graficos.js';
import { ico } from '../icones.js';

let clientes = [], etapas = [], origens = [];
let filtroEtapa = 'todos', filtroLead = 'atencao', visao = 'abertas', mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const ficha = (c) => `/admin/crm/cliente/#${c.id}`;
const nomeEtapa = (id) => etapas.find((e) => e.id === id)?.nome || id;
const etiqueta = (id) => `<span class="crm-etapa" data-etapa="${id}">${esc(nomeEtapa(id))}</span>`;
const achar = (id) => clientes.find((c) => c.id === id);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/* ---------- preferências da tela (só neste navegador) ---------- */

const lembrar = (k, v) => { try { localStorage.setItem('crm-' + k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} };
const lembrado = (k, padrao) => {
  try { const v = localStorage.getItem('crm-' + k); return v == null ? padrao : (typeof padrao === 'string' ? v : JSON.parse(v)); }
  catch (e) { return padrao; }
};

/* ---------- abas ---------- */

const ABAS = ['geral', 'tarefas', 'calendario', 'leads', 'clientes'];
function irPara(aba) {
  if (!ABAS.includes(aba)) aba = 'geral';
  $$('[data-aba]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  ABAS.forEach((a) => { $('#aba-' + a).hidden = a !== aba; });
  history.replaceState(null, '', aba === 'geral' ? location.pathname : '#' + aba);
}
$$('[data-aba]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.aba)));
addEventListener('hashchange', () => irPara(location.hash.slice(1)));

/* ---------- Visão geral ---------- */

function desenharGeral() {
  const h = new Date().getHours();
  const tarefas = todasTarefas(clientes).filter((t) => t.estado !== 'feita');
  const hoje = tarefas.filter((t) => grupoPrazo(t) === 'hoje');
  const vencidas = tarefas.filter((t) => grupoPrazo(t) === 'atrasada');
  const urgentes = tarefas.filter((t) => t.prioridade === 'urgente');
  const fila = tarefas.filter((t) => t.claude === 'fila' || t.claude === 'trabalhando');
  const leadsAtencao = visiveis(clientes).filter(leadPedeAtencao);
  const projetos = visiveis(clientes).flatMap((c) => c.projetos.map((p) => ({ ...p, cliente: c })));
  const emAndamento = projetos.filter((p) => p.estado === 'andamento');

  // Resumo da manhã: uma frase com o que pede atenção.
  const partes = [];
  if (hoje.length) partes.push(plural(hoje.length, 'tarefa vence hoje', 'tarefas vencem hoje'));
  if (vencidas.length) partes.push(plural(vencidas.length, 'está atrasada', 'estão atrasadas'));
  if (leadsAtencao.length) partes.push(plural(leadsAtencao.length, 'lead pede follow-up', 'leads pedem follow-up'));
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  $('#boas').innerHTML = boasVindas({ saudacao, frase: partes.length ? partes.join(', ') + '.' : 'Nada urgente por enquanto.', clientes });
  $('#ritmo').innerHTML = barrasRitmo(ritmo(clientes));
  $('#rosca').innerHTML = roscaPrioridade(clientes);
  $('#faixa').innerHTML = faixaPrazos(clientes);

  const kpi = (rotulo, valor, apoio, link, icone, extra = '') => `<a class="crm-kpi${extra}" href="${link}">
      <span class="crm-kpi__ico">${ico(icone).outerHTML}</span>
      <span class="crm-kpi__rotulo">${rotulo}</span><b class="crm-kpi__valor">${valor}</b><span class="crm-kpi__apoio">${apoio}</span></a>`;
  $('#kpis').innerHTML = [
    kpi('Urgentes', urgentes.length, urgentes.length ? 'Prioridade urgente, abertas' : 'Nenhuma urgência', '#tarefas', 'ia', ' crm-kpi--destaque'),
    kpi('Vencem hoje', hoje.length, hoje.length ? 'Prazo é hoje' : 'Nada para hoje', '#tarefas', 'tarefas'),
    kpi('Atrasadas', vencidas.length, vencidas.length ? 'Passaram do prazo' : 'Tudo no prazo', '#tarefas', 'calendario', vencidas.length ? ' crm-kpi--alerta' : ''),
    kpi('Follow-ups', leadsAtencao.length, leadsAtencao.length ? 'Leads para falar ou parados' : 'Leads em dia', '#leads', 'leads', leadsAtencao.length ? ' crm-kpi--alerta' : ''),
    kpi('Projetos em andamento', emAndamento.length, `${projetos.filter((p) => p.estado === 'proximo').length} na fila para começar`, '#clientes', 'painel'),
    kpi('Fila do Claude', fila.length, fila.length ? 'Peça: "pega a fila do CRM"' : 'Nada na fila', '#tarefas', 'enviar'),
  ].join('');

  $('#hoje-lista').innerHTML = ordenarTarefas([...vencidas, ...hoje, ...urgentes.filter((t) => !['hoje', 'atrasada'].includes(grupoPrazo(t)))])
    .slice(0, 8).map((t) => linhaTarefa(t)).join('') || '<li class="vazio">Nada para hoje nem atrasado.</li>';

  const conta = (id) => visiveis(clientes).filter((c) => c.etapa === id).length;
  const max = Math.max(1, ...etapas.map((e) => conta(e.id)));
  $('#barras').innerHTML = etapas.map((e) => `<li>
      <span class="crm-barras__nome">${esc(e.nome)}</span>
      <span class="crm-barras__trilho"><span class="crm-barras__cheio" data-etapa="${e.id}" style="width:${(conta(e.id) / max) * 100}%"></span></span>
      <b>${conta(e.id)}</b>
    </li>`).join('');

  $('#dica-entregas').textContent = `${DIAS_PROXIMAS} dias`;
  const entregas = tarefas.filter((t) => t.prazo && t.prazo >= hojeIso() && diasAte(t.prazo) <= DIAS_PROXIMAS)
    .sort((a, b) => (a.tipo !== 'entrega') - (b.tipo !== 'entrega') || a.prazo.localeCompare(b.prazo));
  const item = (href, data, alerta, titulo, apoio) => `<li><a href="${href}"${href.startsWith('#') ? '' : ' target="_blank" rel="noopener"'}>
      <span class="crm-lista__data${alerta ? ' atraso' : ''}">${data}</span>
      <span class="crm-lista__txt"><b>${esc(titulo)}</b><small>${esc(apoio)}</small></span></a></li>`;
  $('#entregas').innerHTML = entregas.slice(0, 7).map((t) => item(t.cliente.interno ? '#tarefas' : ficha(t.cliente), prazoTexto(t.prazo), false,
    t.titulo, `${t.tipo === 'entrega' ? 'Entrega · ' : ''}${t.cliente.interno ? 'Empresa' : t.cliente.nome}`)).join('')
    || `<li class="vazio">Nada com prazo nos próximos ${DIAS_PROXIMAS} dias.</li>`;

  $('#leads-atencao').innerHTML = leadsAtencao.sort((a, b) => (a.proximoContato || '0').localeCompare(b.proximoContato || '0')).slice(0, 7)
    .map((c) => item(ficha(c), c.proximoContato ? prazoTexto(c.proximoContato) : `${diasSemMovimento(c)}d`, true, c.nome, situacaoLead(c).texto)).join('')
    || '<li class="vazio">Nenhum lead pedindo follow-up.</li>';

  $('#projetos').innerHTML = projetos.filter((p) => p.estado === 'andamento' || p.estado === 'proximo')
    .sort((a, b) => (a.estado !== 'andamento') - (b.estado !== 'andamento') || (a.prazo || '9').localeCompare(b.prazo || '9')).slice(0, 7)
    .map((p) => item(ficha(p.cliente) + '&projetos', p.prazo ? prazoTexto(p.prazo) : '...', p.prazo && p.prazo < hojeIso(), p.nome, `${NOMES.projeto[p.estado]} · ${p.cliente.nome}`)).join('')
    || '<li class="vazio">Nenhum projeto cadastrado. Cadastre na ficha do cliente, aba Projetos.</li>';

  const linhas = clientes.flatMap((c) => (c.linha || []).map((l) => ({ ...l, cliente: c }))).sort((a, b) => b.data.localeCompare(a.data));
  $('#mudancas').innerHTML = linhas.slice(0, 10).map((l) => `<li><a href="${l.cliente.interno ? '#tarefas' : ficha(l.cliente)}"${l.cliente.interno ? '' : ' target="_blank" rel="noopener"'}>
      <span class="crm-lista__txt"><b>${esc(l.cliente.interno ? 'Empresa' : l.cliente.nome)}</b><small>${esc(l.texto)}</small></span>
      <span class="crm-lista__quando">${quando(l.data)}${l.origem === 'claude' ? '<i>Claude</i>' : ''}</span></a></li>`).join('') || '<li class="vazio">Nada ainda.</li>';
}

/* ---------- Tarefas ---------- */

// Visões prontas, no estilo das visões salvas do Twenty. As do Samuel ficam neste navegador.
const VISOES = {
  abertas: { nome: 'Abertas', filtro: (t) => t.estado !== 'feita' },
  urgentes: { nome: 'Urgentes', filtro: (t) => t.estado !== 'feita' && (t.prioridade === 'urgente' || t.prioridade === 'alta') },
  hoje: { nome: 'Hoje e atrasadas', filtro: (t) => ['hoje', 'atrasada'].includes(grupoPrazo(t)) },
  entregas: { nome: 'Entregas', filtro: (t) => t.estado !== 'feita' && t.tipo === 'entrega' },
  claude: { nome: 'Fila do Claude', filtro: (t) => Boolean(t.claude) && t.claude !== 'feita' },
  empresa: { nome: 'Da empresa', filtro: (t) => t.estado !== 'feita' && t.cliente.interno },
};
let minhasVisoes = lembrado('visoes', []);

function desenharVisoes() {
  $('#visoes').innerHTML = [
    ...Object.entries(VISOES).map(([k, v]) => `<button type="button" data-visao="${k}" aria-pressed="${visao === k}">${v.nome}</button>`),
    ...minhasVisoes.map((v, i) => `<button type="button" data-visao="minha-${i}" aria-pressed="${visao === 'minha-' + i}">${esc(v.nome)}<span data-tirar="${i}" title="Tirar esta visão" aria-label="Tirar a visão ${esc(v.nome)}">×</span></button>`),
  ].join('');
}

function desenharTarefas() {
  desenharVisoes();
  const sel = $('#filtro-cliente'), valor = sel.value;
  sel.innerHTML = '<option value="">Todos</option><option value="interno">Só da empresa</option>'
    + visiveis(clientes).sort((a, b) => a.nome.localeCompare(b.nome)).map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  sel.value = valor;

  const minha = visao.startsWith('minha-') ? minhasVisoes[+visao.slice(6)] : null;
  const base = minha ? VISOES[minha.base] || VISOES.abertas : VISOES[visao] || VISOES.abertas;
  const feitas = $('#mostrar-feitas').checked;
  const cli = sel.value;
  let lista = todasTarefas(clientes).filter((t) => (feitas && t.estado === 'feita') || base.filtro(t))
    .filter((t) => !cli || (cli === 'interno' ? t.cliente.interno : t.cliente.id === cli));
  lista = ordenarTarefas(lista);

  const por = $('#agrupar').value;
  const grupos = new Map();
  const chave = (t) => por === 'prazo' ? grupoPrazo(t) : por === 'cliente' ? (t.cliente.interno ? 'Empresa' : t.cliente.nome) : por === 'prioridade' ? t.prioridade : t.estado;
  const nomeGrupo = (k) => por === 'prazo' ? NOMES.grupo[k] : por === 'prioridade' ? NOMES.prioridade[k] : por === 'estado' ? NOMES.estado[k] : k;
  const ordem = por === 'prazo' ? Object.keys(NOMES.grupo) : por === 'prioridade' ? Object.keys(NOMES.prioridade) : por === 'estado' ? Object.keys(NOMES.estado) : null;
  for (const t of lista) { const k = chave(t); if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(t); }
  const chaves = ordem ? ordem.filter((k) => grupos.has(k)) : [...grupos.keys()].sort((a, b) => a.localeCompare(b));
  const fechados = lembrado('fechados', []);

  $('#grupos').innerHTML = chaves.map((k) => `<details class="tf-grupo" data-grupo="${esc(por + ':' + k)}"${fechados.includes(por + ':' + k) ? '' : ' open'}>
      <summary><span class="tf-grupo__nome${k === 'atrasada' ? ' atraso' : ''}">${esc(nomeGrupo(k))}</span><span class="tf-grupo__n">${grupos.get(k).length}</span></summary>
      <ul class="tf-lista">${grupos.get(k).map((t) => linhaTarefa(t, { mostrarCliente: por !== 'cliente' })).join('')}</ul>
    </details>`).join('') || `<div class="crm-card-box crm-vazio-grande"><b>Nada aqui.</b><p>Nenhuma tarefa nesta visão. Use "Nova tarefa" no topo.</p></div>`;
}

$('#visoes').addEventListener('click', (e) => {
  const tirar = e.target.closest('[data-tirar]');
  if (tirar) {
    e.stopPropagation();
    minhasVisoes.splice(+tirar.dataset.tirar, 1);
    lembrar('visoes', minhasVisoes);
    visao = 'abertas';
    return desenharTarefas();
  }
  const b = e.target.closest('[data-visao]');
  if (!b) return;
  visao = b.dataset.visao;
  const minha = visao.startsWith('minha-') ? minhasVisoes[+visao.slice(6)] : null;
  if (minha) { $('#agrupar').value = minha.agrupar; $('#filtro-cliente').value = minha.cliente; $('#mostrar-feitas').checked = minha.feitas; }
  desenharTarefas();
});
$('#salvar-visao').addEventListener('click', () => {
  const nome = (prompt('Nome da visão (ex.: Semana da SW):') || '').trim().slice(0, 40);
  if (!nome) return;
  minhasVisoes.push({ nome, base: visao.startsWith('minha-') ? 'abertas' : visao, agrupar: $('#agrupar').value, cliente: $('#filtro-cliente').value, feitas: $('#mostrar-feitas').checked });
  lembrar('visoes', minhasVisoes);
  visao = 'minha-' + (minhasVisoes.length - 1);
  desenharTarefas();
});
for (const id of ['#agrupar', '#filtro-cliente', '#mostrar-feitas']) $(id).addEventListener('change', () => { lembrar('agrupar', $('#agrupar').value); desenharTarefas(); });
$('#grupos').addEventListener('toggle', (e) => {
  const g = e.target.closest('.tf-grupo');
  if (!g) return;
  const fechados = new Set(lembrado('fechados', []));
  if (g.open) fechados.delete(g.dataset.grupo); else fechados.add(g.dataset.grupo);
  lembrar('fechados', [...fechados]);
}, true);

/* ---------- Calendário ---------- */

function eventosDoMes() {
  const ev = [];
  for (const t of todasTarefas(clientes)) {
    if (t.prazo && t.estado !== 'feita') ev.push({ data: t.prazo, tipo: t.tipo === 'entrega' ? 'entrega' : 'tarefa', txt: t.titulo, apoio: t.cliente.interno ? 'Empresa' : t.cliente.nome, cliente: t.cliente, tarefa: t, atraso: t.prazo < hojeIso() });
  }
  for (const c of visiveis(clientes)) {
    if (c.proximoContato && LEADS.includes(c.etapa)) ev.push({ data: c.proximoContato, tipo: 'lead', txt: `Falar com ${c.nome}`, apoio: 'Follow-up', cliente: c });
    if (c.fim && c.etapa !== 'encerrado') ev.push({ data: c.fim, tipo: 'contrato', txt: `Fim do contrato: ${c.nome}`, apoio: 'Vigência', cliente: c });
    for (const p of c.projetos) if (p.prazo && p.estado !== 'entregue') ev.push({ data: p.prazo, tipo: 'entrega', txt: `Projeto: ${p.nome}`, apoio: c.nome, cliente: c });
  }
  return ev;
}

function desenharCalendario() {
  $('#mes-nome').textContent = mes.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  const ev = eventosDoMes();
  const recuo = (mes.getDay() + 6) % 7;   // semana começa na segunda
  const noMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  const dias = Array.from({ length: Math.ceil((recuo + noMes) / 7) * 7 }, (_, i) => new Date(mes.getFullYear(), mes.getMonth(), 1 - recuo + i));
  const hoje = hojeIso();
  $('#cal').innerHTML = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((n) => `<b class="cal__semana">${n}</b>`).join('') + dias.map((d) => {
    const iso = d.toLocaleDateString('en-CA');
    const doDia = ev.filter((e) => e.data === iso);
    const fora = d.getMonth() !== mes.getMonth();
    return `<div class="cal__dia${fora ? ' fora' : ''}${iso === hoje ? ' hoje' : ''}${doDia.length ? '' : ' vazio'}" data-dia="${iso}">
      <span class="cal__n">${d.getDate()}<small>${d.toLocaleDateString('pt-BR', { weekday: 'short', day: 'numeric', month: 'short' })}</small></span>
      ${doDia.map((e) => `<a class="cal-ev cal-ev--${e.tipo}${e.atraso ? ' atraso' : ''}" href="${e.cliente.interno ? '#tarefas' : ficha(e.cliente)}"${e.tarefa ? ` data-cliente="${e.cliente.id}" data-tarefa="${e.tarefa.id}"` : ''} title="${esc(e.txt)} · ${esc(e.apoio)}">${esc(e.txt)}</a>`).join('')}
    </div>`;
  }).join('');
}
$('#cal').addEventListener('click', (e) => {
  const ev = e.target.closest('.cal-ev');
  if (ev?.dataset.tarefa) {
    e.preventDefault();
    const c = achar(ev.dataset.cliente);
    return abrirTarefa({ cliente: c, tarefa: c.atividades.find((t) => t.id === ev.dataset.tarefa), clientes, aoSalvar: guardar });
  }
  if (ev) return;   // link normal: abre a ficha
  const dia = e.target.closest('.cal__dia');
  if (dia) abrirTarefa({ clientes, aoSalvar: guardar, prazo: dia.dataset.dia });
});
const mudarMes = (n) => { mes = new Date(mes.getFullYear(), mes.getMonth() + n, 1); desenharCalendario(); };
$('#mes-ant').onclick = () => mudarMes(-1);
$('#mes-prox').onclick = () => mudarMes(1);
$('#mes-hoje').onclick = () => { mes = new Date(new Date().getFullYear(), new Date().getMonth(), 1); desenharCalendario(); };

/* ---------- Leads ---------- */

const FILTROS_LEAD = {
  atencao: { nome: 'Pedem atenção', filtro: (c) => LEADS.includes(c.etapa) && leadPedeAtencao(c) },
  todos: { nome: 'Todos em aberto', filtro: (c) => LEADS.includes(c.etapa) },
  lead: { nome: 'Lead', filtro: (c) => c.etapa === 'lead' },
  proposta: { nome: 'Proposta enviada', filtro: (c) => c.etapa === 'proposta' },
  semdata: { nome: 'Sem data de follow-up', filtro: (c) => LEADS.includes(c.etapa) && !c.proximoContato },
  perdidos: { nome: 'Não fecharam', filtro: (c) => c.etapa === 'encerrado' && Boolean(c.motivoPerda) },
};

function desenharLeads() {
  const todos = visiveis(clientes);
  $('#leads-filtros').innerHTML = Object.entries(FILTROS_LEAD).map(([k, f]) =>
    `<button type="button" data-filtro="${k}" aria-pressed="${filtroLead === k}">${f.nome} <span>${todos.filter(f.filtro).length}</span></button>`).join('');
  const lista = todos.filter(FILTROS_LEAD[filtroLead].filtro)
    .sort((a, b) => leadPedeAtencao(b) - leadPedeAtencao(a) || (a.proximoContato || '9').localeCompare(b.proximoContato || '9'));
  const abertos = todos.filter((c) => LEADS.includes(c.etapa)).length;
  $('#leads-sub').textContent = `${plural(abertos, 'lead em aberto', 'leads em aberto')}. Lead sem data e sem movimento há 7 dias aparece como parado.`;
  $('#leads-linhas').innerHTML = lista.map((c) => {
    const s = situacaoLead(c);
    const ultima = (c.linha || []).at(-1);
    return `<tr data-id="${c.id}">
      <td><a class="crm-cli" href="${ficha(c)}" target="_blank" rel="noopener"><span class="crm-avatar" aria-hidden="true">${esc(iniciais(c.nome))}</span>
        <span><b>${esc(c.nome)}</b><small>${esc(c.servico || c.contato || 'Sem detalhes')}</small></span></a></td>
      <td>${etiqueta(c.etapa)}</td>
      <td><small class="forte">${c.origemLead ? NOMES.origem[c.origemLead] : 'Não informada'}</small></td>
      <td>${s ? `<span class="crm-situacao${s.alerta ? ' alerta' : ''}">${esc(s.texto)}</span>` : `<small>${esc(c.motivoPerda)}</small>`}</td>
      <td><small class="forte">${plural(diasNaEtapa(c), 'dia', 'dias')}</small></td>
      <td><small>${ultima ? quando(ultima.data) + (ultima.origem === 'claude' ? ' · Claude' : '') : ''}</small></td>
      <td class="crm-tabela__acoes">${LEADS.includes(c.etapa) ? '<button class="mini" type="button" data-acao="contato">Registrar contato</button>' : ''}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" class="vazio">${abertos ? 'Ninguém neste filtro.' : 'Nenhum lead em aberto. Use "Novo cliente ou lead".'}</td></tr>`;
}
$('#leads-filtros').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (b) { filtroLead = b.dataset.filtro; desenharLeads(); }
});

// Registrar contato: anota na linha do tempo, marca o próximo follow-up e, se for o caso, muda a etapa.
let contatoCom = null;
$('#leads-linhas').addEventListener('click', (e) => {
  if (e.target.closest('[data-acao="contato"]')) abrirContato(achar(e.target.closest('tr').dataset.id));
});
function abrirContato(c) {
  contatoCom = c;
  const f = $('#contato-form');
  f.reset();
  $('#contato-titulo').textContent = `Contato com ${c.nome}`;
  $('#contato-etapa').innerHTML = etapas.map((e) => `<option value="${e.id}">${e.id === 'encerrado' ? 'Não fechou (encerrar)' : esc(e.nome)}</option>`).join('');
  f.elements.etapa.value = c.etapa;
  f.elements.proximoContato.value = somarDias(7);
  $('#contato-perda').hidden = true;
  $('#contato-jan').showModal();
}
$('#contato-etapa').addEventListener('change', (e) => {
  const perde = e.target.value === 'encerrado';
  $('#contato-perda').hidden = !perde;
  if (perde) $('#contato-form').elements.proximoContato.value = '';
});
$('#contato-atalhos').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dias]');
  if (b) $('#contato-form').elements.proximoContato.value = somarDias(+b.dataset.dias);
});
$('#contato-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  try {
    await anotar(contatoCom.id, `Contato: ${f.texto.value.trim()}`, 'nota');
    const dado = { id: contatoCom.id, etapa: f.etapa.value, proximoContato: f.etapa.value === 'encerrado' ? '' : f.proximoContato.value };
    if (f.etapa.value === 'encerrado') dado.motivoPerda = f.motivoPerda.value.trim() || 'Não informado';
    guardar(await salvarCliente(dado));
    $('#contato-jan').close();
    avisar(dado.proximoContato ? `Contato registrado. Próximo follow-up: ${dataCurta(dado.proximoContato)}.` : 'Contato registrado.');
  } catch (err) { avisar(err.message, 'erro'); }
});

/* ---------- Clientes ---------- */

function vista(v) {
  $$('[data-vista]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === v)));
  $('#vista-tabela').hidden = v !== 'tabela';
  $('#funil').hidden = v !== 'funil';
  lembrar('vista', v);
}
$$('[data-vista]').forEach((b) => b.addEventListener('click', () => vista(b.dataset.vista)));

function desenharClientes() {
  const busca = $('#busca').value.trim().toLowerCase();
  const lista = visiveis(clientes).filter((c) => !busca || c.nome.toLowerCase().includes(busca) || (c.servico || '').toLowerCase().includes(busca));
  const conta = (id) => lista.filter((c) => c.etapa === id).length;
  $('#filtros').innerHTML = [`<button type="button" data-filtro="todos" aria-pressed="${filtroEtapa === 'todos'}">Todos <span>${lista.length}</span></button>`,
    ...etapas.map((e) => `<button type="button" data-filtro="${e.id}" aria-pressed="${filtroEtapa === e.id}">${esc(e.nome)} <span>${conta(e.id)}</span></button>`)].join('');

  const daqui = lista.filter((c) => filtroEtapa === 'todos' || c.etapa === filtroEtapa);
  $('#linhas').innerHTML = daqui.map((c) => {
    const prox = proximaEntrega(c), atr = atrasadas(c).length, n = abertas(c).length, proj = projetoAtual(c);
    return `<tr data-id="${c.id}" class="clicavel">
      <td><a class="crm-cli" href="${ficha(c)}" target="_blank" rel="noopener">
        <span class="crm-avatar" aria-hidden="true">${esc(iniciais(c.nome))}</span>
        <span><b>${esc(c.nome)}</b><small>${esc(c.servico || 'Sem serviço na ficha')}</small></span></a></td>
      <td>${etiqueta(c.etapa)}<small>há ${plural(diasNaEtapa(c), 'dia', 'dias')}</small></td>
      <td><small class="forte crm-quebra">${esc(c.proximoPasso || 'Sem próximo passo')}</small></td>
      <td>${proj ? `<b>${esc(proj.nome)}</b><small>${NOMES.projeto[proj.estado]}</small>` : '<small>Nenhum</small>'}</td>
      <td>${prox ? `<b>${prazoTexto(prox.prazo)}</b><small>${esc(prox.titulo)}</small>` : '<small>Sem prazo marcado</small>'}</td>
      <td>${n ? `<b>${n}</b>${atr ? ` <span class="crm-atraso">${atr} atrasada${atr > 1 ? 's' : ''}</span>` : ''}` : '<small>Nenhuma</small>'}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="vazio">${lista.length ? 'Ninguém com esse filtro.' : 'Nenhum cliente ainda. Comece por "Novo cliente ou lead".'}</td></tr>`;

  $('#funil').innerHTML = etapas.map((e) => {
    const coluna = lista.filter((c) => c.etapa === e.id);
    return `<section class="crm-col" data-etapa="${e.id}">
      <div class="crm-col__topo">${esc(e.nome)}<span class="crm-col__n">${coluna.length}</span></div>
      <div class="crm-col__lista">${coluna.map(cartao).join('') || '<p class="crm-col__vazia">Ninguém aqui.</p>'}</div>
    </section>`;
  }).join('');
}

function cartao(c) {
  const n = abertas(c).length, s = situacaoLead(c);
  return `<a class="crm-card" href="${ficha(c)}" target="_blank" rel="noopener" draggable="true" data-id="${c.id}">
    <span class="crm-card__nome">${esc(c.nome)}</span>
    ${c.servico ? `<span class="crm-card__serv">${esc(c.servico)}</span>` : ''}
    ${c.proximoPasso ? `<span class="crm-card__prox">${esc(c.proximoPasso)}</span>` : ''}
    <span class="crm-card__pe">${s ? `<span class="${s.alerta ? 'claude' : ''}">${esc(s.texto)}</span>` : ''}${n ? `<span>${plural(n, 'tarefa', 'tarefas')}</span>` : ''}<span>${diasNaEtapa(c)}d na etapa</span></span>
  </a>`;
}

$('#filtros').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (b) { filtroEtapa = b.dataset.filtro; desenharClientes(); }
});
$('#busca').addEventListener('input', desenharClientes);

/* Prévia lateral: clicar na linha (fora do nome) mostra o resumo sem sair da lista. */
$('#linhas').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  const tr = e.target.closest('tr[data-id]');
  if (tr) previa(achar(tr.dataset.id));
});
function previa(c) {
  $('#pv-nome').textContent = c.nome;
  $('#pv-abrir').href = ficha(c);
  const tarefas = ordenarTarefas(abertas(c).map((t) => ({ ...t, cliente: c }))).slice(0, 6);
  const ultimas = [...(c.linha || [])].reverse().slice(0, 4);
  const s = situacaoLead(c);
  $('#pv-corpo').innerHTML = `
    <div class="pv-topo">${etiqueta(c.etapa)}<small>há ${plural(diasNaEtapa(c), 'dia', 'dias')} nesta etapa</small></div>
    ${s ? `<p class="crm-situacao${s.alerta ? ' alerta' : ''}">${esc(s.texto)}</p>` : ''}
    <dl class="pv-dados">
      <dt>Próximo passo</dt><dd>${esc(c.proximoPasso || 'Sem próximo passo')}</dd>
      <dt>O que quer ou contratou</dt><dd>${esc(c.servico || 'Não informado')}</dd>
      <dt>Contato</dt><dd>${esc(c.contato || 'Sem contato')}</dd>
      ${projetoAtual(c) ? `<dt>Projeto atual</dt><dd>${esc(projetoAtual(c).nome)}</dd>` : ''}
    </dl>
    <h3 class="pv-h">Tarefas abertas</h3>
    <ul class="tf-lista tf-lista--compacta">${tarefas.map((t) => linhaTarefa(t, { mostrarCliente: false })).join('') || '<li class="vazio">Nenhuma.</li>'}</ul>
    <h3 class="pv-h">Últimas mudanças</h3>
    <ul class="crm-lista">${ultimas.map((l) => `<li><span class="crm-lista__txt"><b>${esc(l.texto)}</b><small>${quando(l.data)}${l.origem === 'claude' ? ' · Claude' : ''}</small></span></li>`).join('')}</ul>`;
  if (!$('#previa').open) $('#previa').showModal();
}

/* Arrastar o cartão para outra coluna muda a etapa. */
const funil = $('#funil');
const limparAlvo = () => $$('.crm-col.alvo').forEach((c) => c.classList.remove('alvo'));
funil.addEventListener('dragstart', (e) => {
  const card = e.target.closest('.crm-card');
  if (card) e.dataTransfer.setData('text/plain', card.dataset.id);
});
funil.addEventListener('dragover', (e) => {
  const col = e.target.closest('.crm-col');
  if (!col) return;
  e.preventDefault();
  if (!col.classList.contains('alvo')) { limparAlvo(); col.classList.add('alvo'); }
});
funil.addEventListener('dragleave', (e) => { if (!funil.contains(e.relatedTarget)) limparAlvo(); });
funil.addEventListener('drop', async (e) => {
  const col = e.target.closest('.crm-col');
  limparAlvo();
  const c = achar(e.dataTransfer.getData('text/plain'));
  if (!col || !c || c.etapa === col.dataset.etapa) return;
  e.preventDefault();
  try { guardar(await salvarCliente({ id: c.id, etapa: col.dataset.etapa })); }
  catch (err) { avisar(err.message, 'erro'); }
});

/* ---------- novo cliente, nova tarefa ---------- */

$('#novo').onclick = () => {
  $('#novo-form').reset();
  $('#novo-jan').showModal();
  $('#novo-form').elements.nome.focus();
};
$('#novo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (clientes.some((c) => c.nome.toLowerCase() === f.nome.value.trim().toLowerCase())) {
    return avisar('Já existe um cliente com esse nome. Abra a ficha dele.', 'erro');
  }
  try {
    const salvo = await salvarCliente({ nome: f.nome.value, etapa: f.etapa.value, servico: f.servico.value, origemLead: f.origemLead.value, proximoContato: f.proximoContato.value });
    guardar(salvo);
    $('#novo-jan').close();
    window.open(ficha(salvo), '_blank', 'noopener');
  } catch (err) { avisar(err.message, 'erro'); }
});
$('#nova-tarefa').onclick = () => abrirTarefa({ clientes, aoSalvar: guardar });

$$('dialog [data-fechar]').forEach((b) => { b.onclick = () => b.closest('dialog').close(); });

/* ---------- carga ---------- */

function guardar(salvo) {
  normalizar(salvo);
  const i = clientes.findIndex((c) => c.id === salvo.id);
  if (i >= 0) clientes[i] = salvo; else clientes.unshift(salvo);
  desenhar();
  if ($('#previa').open && $('#pv-abrir').href.endsWith(salvo.id)) previa(salvo);
}

function desenhar() { desenharGeral(); desenharTarefas(); desenharCalendario(); desenharLeads(); desenharClientes(); }

for (const raiz of ['#hoje-lista', '#grupos', '#pv-corpo']) ligarLista($(raiz), { achar, aoSalvar: guardar, clientes: () => clientes });
const abrirBusca = ligarBusca(() => clientes);
$('#buscar').onclick = abrirBusca;

async function carregar() {
  const d = await carregarCrm();
  clientes = d.clientes; etapas = d.etapas; origens = d.origens || [];
  $('#novo-etapa').innerHTML = etapas.filter((e) => e.id !== 'encerrado').map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
  $('#novo-origem').innerHTML = '<option value="">Não informada</option>' + origens.map((o) => `<option value="${o}">${NOMES.origem[o] || o}</option>`).join('');
  desenhar();
}

$('#agrupar').value = lembrado('agrupar', 'prazo');
vista(lembrado('vista', 'tabela'));
irPara(location.hash.slice(1));
carregar().then(() => {
  // "Nova tarefa" do menu lateral chega aqui com ?nova=tarefa.
  if (new URLSearchParams(location.search).get('nova') === 'tarefa') {
    history.replaceState(null, '', location.pathname + location.hash);
    abrirTarefa({ clientes, aoSalvar: guardar });
  }
}).catch((e) => { $('#kpis').innerHTML = `<p class="vazio">${esc(e.message)}</p>`; });
// Voltou de uma ficha (outra aba) ou o Claude mexeu: traz o que mudou, sem atrapalhar janela aberta.
addEventListener('focus', () => { if (!document.querySelector('dialog[open]')) carregar().catch(() => {}); });
