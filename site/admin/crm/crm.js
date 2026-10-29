/* CRM: Visão geral (números, gráficos, entregas) e Clientes (tabela
   ou funil). A ficha de cada cliente mora em /admin/crm/cliente/#id.
   O Claude grava pela mesma API, com a chave dele. */

import {
  $, esc, avisar, pedir, documentos, dinheiro, hojeIso, dataCurta, diasAte, quando,
  abertas, atrasadas, proximaEntrega, iniciais, ATIVOS,
} from './comum.js';

let clientes = [], etapas = [], docs = { propostas: [], faturas: [], formularios: [] };
let filtro = 'todos', moeda = 'BRL';
const ficha = (c) => `/admin/crm/cliente/#${c.id}`;
const nomeEtapa = (id) => etapas.find((e) => e.id === id)?.nome || id;
const etiqueta = (id) => `<span class="crm-etapa" data-etapa="${id}">${esc(nomeEtapa(id))}</span>`;

/* ---------- abas e preferências da tela ---------- */

const lembrar = (k, v) => { try { localStorage.setItem('crm-' + k, v); } catch (e) {} };
const lembrado = (k, padrao) => { try { return localStorage.getItem('crm-' + k) || padrao; } catch (e) { return padrao; } };

function irPara(aba) {
  document.querySelectorAll('[data-aba]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.aba === aba)));
  $('#aba-geral').hidden = aba !== 'geral';
  $('#aba-clientes').hidden = aba !== 'clientes';
  history.replaceState(null, '', aba === 'geral' ? location.pathname : '#clientes');
}
document.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.aba)));

function vista(v) {
  document.querySelectorAll('[data-vista]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.vista === v)));
  $('#vista-tabela').hidden = v !== 'tabela';
  $('#funil').hidden = v !== 'funil';
  lembrar('vista', v);
}
document.querySelectorAll('[data-vista]').forEach((b) => b.addEventListener('click', () => vista(b.dataset.vista)));

/* ---------- Visão geral ---------- */

function desenharGeral() {
  $('#hoje').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const conta = (id) => clientes.filter((c) => c.etapa === id).length;
  const nAtrasadas = clientes.reduce((n, c) => n + atrasadas(c).length, 0);

  // Recorrente: soma do valor de quem é recorrente e está ativo, por moeda.
  const recorrente = {};
  for (const c of clientes) if (c.tipo === 'recorrente' && ATIVOS.includes(c.etapa) && c.valor) recorrente[c.moeda] = (recorrente[c.moeda] || 0) + c.valor;
  const aReceber = {};
  for (const f of docs.faturas) if (!f.paga) aReceber[f.moeda || 'BRL'] = (aReceber[f.moeda || 'BRL'] || 0) + (Number(f.valor) || 0);
  const somas = (o) => Object.entries(o).sort(([a], [b]) => (b === 'BRL') - (a === 'BRL')).map(([m, v]) => dinheiro(v, m)).join(' · ');
  const semValor = clientes.filter((c) => c.tipo === 'recorrente' && ATIVOS.includes(c.etapa) && c.valor == null).length;

  const kpi = (rotulo, valor, apoio, extra = '') => `<article class="crm-kpi${extra}">
      <span class="crm-kpi__rotulo">${rotulo}</span>
      <b class="crm-kpi__valor">${valor}</b>
      <span class="crm-kpi__apoio">${apoio}</span>
    </article>`;
  $('#kpis').innerHTML = [
    kpi('Recorrente por mês', somas(recorrente) || 'Sem valor', semValor ? `${semValor} cliente${semValor > 1 ? 's' : ''} recorrente${semValor > 1 ? 's' : ''} sem valor na ficha` : 'Contratos recorrentes ativos', ' crm-kpi--destaque'),
    kpi('Em andamento', conta('andamento'), `${conta('entregue')} em manutenção`),
    kpi('Sem começar', conta('fechado'), conta('fechado') ? 'Fechados esperando o início' : 'Ninguém parado'),
    kpi('Atividades atrasadas', nAtrasadas, nAtrasadas ? 'Passaram do prazo' : 'Tudo no prazo', nAtrasadas ? ' crm-kpi--alerta' : ''),
    kpi('A receber', somas(aReceber) || dinheiro(0), `${docs.faturas.filter((f) => !f.paga).length} fatura(s) em aberto`),
  ].join('');

  desenharRecebido();

  const max = Math.max(1, ...etapas.map((e) => conta(e.id)));
  $('#barras').innerHTML = etapas.map((e) => `<li>
      <span class="crm-barras__nome">${esc(e.nome)}</span>
      <span class="crm-barras__trilho"><span class="crm-barras__cheio" data-etapa="${e.id}" style="width:${(conta(e.id) / max) * 100}%"></span></span>
      <b>${conta(e.id)}</b>
    </li>`).join('');

  const tarefas = clientes.flatMap((c) => abertas(c).filter((a) => a.prazo).map((a) => ({ ...a, cliente: c })));
  const item = (t) => `<li><a href="${ficha(t.cliente)}" target="_blank" rel="noopener">
      <span class="crm-lista__data${t.prazo < hojeIso() ? ' atraso' : ''}">${dataCurta(t.prazo)}</span>
      <span class="crm-lista__txt"><b>${esc(t.titulo)}</b><small>${esc(t.cliente.nome)}</small></span>
    </a></li>`;
  const proximas = tarefas.filter((t) => t.prazo >= hojeIso() && diasAte(t.prazo) <= 14).sort((a, b) => a.prazo.localeCompare(b.prazo));
  const vencidas = tarefas.filter((t) => t.prazo < hojeIso()).sort((a, b) => a.prazo.localeCompare(b.prazo));
  $('#entregas').innerHTML = proximas.slice(0, 8).map(item).join('') || '<li class="vazio">Nada com prazo nos próximos 14 dias.</li>';
  $('#atrasadas').innerHTML = vencidas.slice(0, 8).map(item).join('') || '<li class="vazio">Nenhuma atividade atrasada.</li>';

  const linhas = clientes.flatMap((c) => (c.linha || []).map((l) => ({ ...l, cliente: c }))).sort((a, b) => b.data.localeCompare(a.data));
  $('#mudancas').innerHTML = linhas.slice(0, 8).map((l) => `<li><a href="${ficha(l.cliente)}" target="_blank" rel="noopener">
      <span class="crm-lista__txt"><b>${esc(l.cliente.nome)}</b><small>${esc(l.texto)}</small></span>
      <span class="crm-lista__quando">${quando(l.data)}${l.origem === 'claude' ? '<i>Claude</i>' : ''}</span>
    </a></li>`).join('') || '<li class="vazio">Nada ainda.</li>';
}

/* Barras dos últimos 6 meses, só com o que já foi pago. */
function desenharRecebido() {
  const pagas = docs.faturas.filter((f) => f.paga);
  const moedas = [...new Set(pagas.map((f) => f.moeda || 'BRL'))];
  if (moedas.length && !moedas.includes(moeda)) moeda = moedas[0];
  $('#moedas').innerHTML = moedas.length > 1
    ? moedas.map((m) => `<button type="button" data-moeda="${m}" aria-pressed="${m === moeda}">${m}</button>`).join('')
    : '';

  const meses = [];
  const d = new Date(); d.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    meses.push({ chave: m.toLocaleDateString('en-CA').slice(0, 7), nome: m.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''), total: 0 });
  }
  for (const f of pagas) {
    if ((f.moeda || 'BRL') !== moeda) continue;
    const mes = meses.find((m) => m.chave === String(f.pagaEm || f.emissao || '').slice(0, 7));
    if (mes) mes.total += Number(f.valor) || 0;
  }
  const total = meses.reduce((n, m) => n + m.total, 0);
  $('#recebido-total').innerHTML = `${dinheiro(total, moeda)} <small>nos últimos 6 meses</small>`;
  if (!pagas.length) { $('#grafico').innerHTML = '<p class="vazio">Quando uma fatura for marcada como paga, ela aparece aqui.</p>'; return; }

  const max = Math.max(1, ...meses.map((m) => m.total));
  const agora = meses.at(-1).chave;
  $('#grafico').innerHTML = `<div class="crm-colunas">${meses.map((m) => `
      <div class="crm-colunas__item" title="${esc(m.nome)}: ${dinheiro(m.total, moeda)}">
        <span class="crm-colunas__valor">${m.total ? dinheiro(m.total, moeda) : ''}</span>
        <span class="crm-colunas__barra${m.chave === agora ? ' atual' : ''}" style="height:${Math.max(2, (m.total / max) * 100)}%"></span>
        <span class="crm-colunas__mes">${esc(m.nome)}</span>
      </div>`).join('')}</div>`;
}
$('#moedas').addEventListener('click', (e) => {
  const b = e.target.closest('[data-moeda]');
  if (b) { moeda = b.dataset.moeda; desenharRecebido(); }
});

/* ---------- Clientes ---------- */

function visiveis() {
  const busca = $('#busca').value.trim().toLowerCase();
  return clientes.filter((c) => (!busca || c.nome.toLowerCase().includes(busca) || (c.servico || '').toLowerCase().includes(busca)));
}

function desenharClientes() {
  const lista = visiveis();
  const conta = (id) => lista.filter((c) => c.etapa === id).length;
  $('#filtros').innerHTML = [`<button type="button" data-filtro="todos" aria-pressed="${filtro === 'todos'}">Todos <span>${lista.length}</span></button>`,
    ...etapas.map((e) => `<button type="button" data-filtro="${e.id}" aria-pressed="${filtro === e.id}">${esc(e.nome)} <span>${conta(e.id)}</span></button>`)].join('');

  const daqui = lista.filter((c) => filtro === 'todos' || c.etapa === filtro);
  $('#linhas').innerHTML = daqui.map((c) => {
    const prox = proximaEntrega(c), atr = atrasadas(c).length, n = abertas(c).length;
    const ultima = (c.linha || []).at(-1);
    return `<tr>
      <td><a class="crm-cli" href="${ficha(c)}" target="_blank" rel="noopener">
        <span class="crm-avatar" aria-hidden="true">${esc(iniciais(c.nome))}</span>
        <span><b>${esc(c.nome)}</b><small>${esc(c.servico || 'Sem serviço na ficha')}</small></span></a></td>
      <td>${etiqueta(c.etapa)}</td>
      <td>${c.valor != null ? `<b>${dinheiro(c.valor, c.moeda)}</b><small>${c.tipo === 'recorrente' ? 'por mês' : c.tipo === 'pontual' ? 'projeto' : ''}</small>` : `<small>${c.tipo === 'recorrente' ? 'Recorrente, sem valor' : c.tipo === 'pontual' ? 'Pontual, sem valor' : 'Sem valor'}</small>`}</td>
      <td>${prox ? `<b>${dataCurta(prox.prazo)}</b><small>${esc(prox.titulo)}</small>` : '<small>Sem prazo marcado</small>'}</td>
      <td>${n ? `<b>${n}</b>${atr ? ` <span class="crm-atraso">${atr} atrasada${atr > 1 ? 's' : ''}</span>` : ''}` : '<small>Nenhuma</small>'}</td>
      <td><small>${ultima ? quando(ultima.data) + (ultima.origem === 'claude' ? ' · Claude' : '') : ''}</small></td>
    </tr>`;
  }).join('') || `<tr><td colspan="6" class="vazio">${clientes.length ? 'Ninguém com esse filtro.' : 'Nenhum cliente ainda. Comece por "Novo cliente".'}</td></tr>`;

  $('#funil').innerHTML = etapas.map((e) => {
    const coluna = lista.filter((c) => c.etapa === e.id);
    return `<section class="crm-col" data-etapa="${e.id}">
      <div class="crm-col__topo">${esc(e.nome)}<span class="crm-col__n">${coluna.length}</span></div>
      <div class="crm-col__lista">${coluna.map(cartao).join('') || '<p class="crm-col__vazia">Ninguém aqui.</p>'}</div>
    </section>`;
  }).join('');
}

function cartao(c) {
  const ultima = (c.linha || []).at(-1);
  const n = abertas(c).length;
  return `<a class="crm-card" href="${ficha(c)}" target="_blank" rel="noopener" draggable="true" data-id="${c.id}">
    <span class="crm-card__nome">${esc(c.nome)}</span>
    ${c.servico ? `<span class="crm-card__serv">${esc(c.servico)}</span>` : ''}
    ${c.proximoPasso ? `<span class="crm-card__prox">${esc(c.proximoPasso)}</span>` : ''}
    <span class="crm-card__pe">${n ? `${n} atividade${n > 1 ? 's' : ''}` : ''}${ultima?.origem === 'claude' ? '<span class="claude">Claude</span>' : ''}</span>
  </a>`;
}

$('#filtros').addEventListener('click', (e) => {
  const b = e.target.closest('[data-filtro]');
  if (b) { filtro = b.dataset.filtro; desenharClientes(); }
});
$('#busca').addEventListener('input', desenharClientes);

/* Arrastar o cartão para outra coluna muda a etapa. */
const funil = $('#funil');
const limparAlvo = () => document.querySelectorAll('.crm-col.alvo').forEach((c) => c.classList.remove('alvo'));
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
  const id = e.dataTransfer.getData('text/plain');
  const c = clientes.find((x) => x.id === id);
  if (!col || !c || c.etapa === col.dataset.etapa) return;
  e.preventDefault();
  try { guardar(await pedir('/api/crm', { method: 'POST', body: JSON.stringify({ id, etapa: col.dataset.etapa }) })); }
  catch (err) { avisar(err.message, 'erro'); }
});

function guardar(salvo) {
  const i = clientes.findIndex((c) => c.id === salvo.id);
  if (i >= 0) clientes[i] = salvo; else clientes.unshift(salvo);
  desenhar();
}

/* ---------- novo cliente ---------- */

$('#novo').onclick = () => { $('#novo-form').reset(); $('#novo-jan').showModal(); $('#novo-form').elements.nome.focus(); };
$('#novo-jan [data-fechar]').onclick = () => $('#novo-jan').close();
$('#novo-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  if (clientes.some((c) => c.nome.toLowerCase() === f.nome.value.trim().toLowerCase())) {
    return avisar('Já existe um cliente com esse nome. Abra a ficha dele.', 'erro');
  }
  try {
    const salvo = await pedir('/api/crm', { method: 'POST', body: JSON.stringify({ nome: f.nome.value, etapa: f.etapa.value, servico: f.servico.value }) });
    guardar(salvo);
    $('#novo-jan').close();
    window.open(ficha(salvo), '_blank', 'noopener');
  } catch (err) { avisar(err.message, 'erro'); }
});

/* ---------- carga ---------- */

function desenhar() { desenharGeral(); desenharClientes(); }

async function carregar() {
  const [d, ds] = await Promise.all([pedir('/api/crm'), documentos()]);
  clientes = d.clientes; etapas = d.etapas; docs = ds;
  $('#novo-etapa').innerHTML = etapas.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
  desenhar();
}

vista(lembrado('vista', 'tabela'));
irPara(location.hash === '#clientes' ? 'clientes' : 'geral');
addEventListener('hashchange', () => irPara(location.hash === '#clientes' ? 'clientes' : 'geral'));
carregar().catch((e) => { $('#kpis').innerHTML = `<p class="vazio">${esc(e.message)}</p>`; });
// Voltou de uma ficha (outra aba): traz o que mudou lá.
addEventListener('focus', () => carregar().catch(() => {}));
