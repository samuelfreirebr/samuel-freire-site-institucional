/* CRM: quadro do funil (uma coluna por etapa) e a ficha do cliente.
   Arrastar um cartão para outra coluna muda a etapa; no celular,
   a etapa muda pela ficha. O Claude grava pela mesma API. */

const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NOMES_ESTADO = { hoje: 'Hoje', semana: 'Semana', aguardando: 'Aguardando', backlog: 'Depois', feita: 'Feita' };

let clientes = [], etapas = [], estados = [], docs = { propostas: [], faturas: [] };
let atual = null;          // cliente aberto na ficha (cópia de trabalho)

function avisar(msg, tipo = 'ok') {
  const a = $('#aviso');
  a.textContent = msg; a.dataset.tipo = tipo; a.classList.add('mostra');
  clearTimeout(avisar.t); avisar.t = setTimeout(() => a.classList.remove('mostra'), 3500);
}

async function pedir(url, opcoes = {}) {
  const r = await fetch(url, { headers: { 'content-type': 'application/json' }, ...opcoes });
  if (r.status === 401) { location.replace('/admin/entrar?voltar=/admin/crm/'); throw new Error('Faça login.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'Não deu para salvar.');
  return d;
}

async function carregar() {
  const d = await pedir('/api/crm');
  clientes = d.clientes; etapas = d.etapas; estados = d.estados;
  $('#f-etapa').innerHTML = etapas.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
  desenhar();
}

const abertas = (c) => (c.atividades || []).filter((a) => a.estado !== 'feita');

function desenhar() {
  const busca = $('#busca').value.trim().toLowerCase();
  const visiveis = clientes.filter((c) => !busca || c.nome.toLowerCase().includes(busca));
  $('#funil').innerHTML = etapas.map((e) => {
    const daqui = visiveis.filter((c) => c.etapa === e.id);
    return `<section class="crm-col" data-etapa="${e.id}">
      <div class="crm-col__topo">${esc(e.nome)}<span class="crm-col__n">${daqui.length}</span></div>
      <div class="crm-col__lista">${daqui.map(cartao).join('') || '<p class="crm-col__vazia">Ninguém aqui.</p>'}</div>
    </section>`;
  }).join('');

  const conta = (id) => clientes.filter((c) => c.etapa === id).length;
  const hoje = clientes.reduce((n, c) => n + abertas(c).filter((a) => a.estado === 'hoje').length, 0);
  $('#resumo').textContent = clientes.length
    ? `${conta('andamento')} em andamento · ${conta('fechado')} sem começar · ${hoje} atividade${hoje === 1 ? '' : 's'} para hoje`
    : 'Nenhum cliente ainda. Comece por "Novo cliente".';
}

function cartao(c) {
  const ultima = (c.linha || []).at(-1);
  const n = abertas(c).length;
  return `<button class="crm-card" type="button" draggable="true" data-id="${c.id}">
    <span class="crm-card__nome">${esc(c.nome)}</span>
    ${c.servico ? `<span class="crm-card__serv">${esc(c.servico)}</span>` : ''}
    ${c.proximoPasso ? `<span class="crm-card__prox">${esc(c.proximoPasso)}</span>` : ''}
    <span class="crm-card__pe">${n ? `${n} atividade${n > 1 ? 's' : ''}` : ''}${ultima?.origem === 'claude' ? '<span class="claude">Claude</span>' : ''}</span>
  </button>`;
}

/* ---------- arrastar entre etapas ---------- */

$('#funil').addEventListener('dragstart', (e) => {
  const card = e.target.closest('.crm-card');
  if (card) e.dataTransfer.setData('text/plain', card.dataset.id);
});
$('#funil').addEventListener('dragover', (e) => {
  const col = e.target.closest('.crm-col');
  if (!col) return;
  e.preventDefault();
  document.querySelectorAll('.crm-col.alvo').forEach((c) => c !== col && c.classList.remove('alvo'));
  col.classList.add('alvo');
});
$('#funil').addEventListener('dragleave', (e) => { if (!e.currentTarget.contains(e.relatedTarget)) document.querySelectorAll('.crm-col.alvo').forEach((c) => c.classList.remove('alvo')); });
$('#funil').addEventListener('drop', async (e) => {
  const col = e.target.closest('.crm-col');
  document.querySelectorAll('.crm-col.alvo').forEach((c) => c.classList.remove('alvo'));
  const id = e.dataTransfer.getData('text/plain');
  const c = clientes.find((x) => x.id === id);
  if (!col || !c || c.etapa === col.dataset.etapa) return;
  e.preventDefault();
  try { guardar(await pedir('/api/crm', { method: 'POST', body: JSON.stringify({ id, etapa: col.dataset.etapa }) })); }
  catch (err) { avisar(err.message, 'erro'); }
});

$('#funil').addEventListener('click', (e) => {
  const card = e.target.closest('.crm-card');
  if (card) abrir(clientes.find((c) => c.id === card.dataset.id));
});

function guardar(salvo) {
  const i = clientes.findIndex((c) => c.id === salvo.id);
  if (i >= 0) clientes[i] = salvo; else clientes.unshift(salvo);
  desenhar();
}

/* ---------- ficha ---------- */

function abrir(c) {
  atual = c ? structuredClone(c) : { nome: '', etapa: 'lead', atividades: [], linha: [] };
  const f = $('#form');
  for (const campo of ['nome', 'etapa', 'servico', 'proximoPasso', 'contato', 'notas']) f.elements[campo].value = atual[campo] || '';
  $('#ficha-titulo').textContent = c ? c.nome : 'Novo cliente';
  desenharAtividades(); desenharLinha(); desenharDocs();
  $('#ficha').showModal();
  if (!c) f.elements.nome.focus();
}

function desenharAtividades() {
  const ops = (sel) => estados.map((s) => `<option value="${s}"${s === sel ? ' selected' : ''}>${NOMES_ESTADO[s] || s}</option>`).join('');
  $('#atividades').innerHTML = (atual.atividades || []).map((a, i) => `<li data-feita="${a.estado === 'feita' ? 1 : 0}">
    <span>${esc(a.titulo)}${a.prazo ? ` <small>até ${a.prazo.split('-').reverse().join('/')}</small>` : ''}</span>
    ${a.origem === 'claude' ? '<b class="claude">Claude</b>' : ''}
    <select data-i="${i}" aria-label="Situação da atividade">${ops(a.estado)}</select>
  </li>`).join('') || '<li class="vazio">Nenhuma atividade.</li>';
}

function desenharLinha() {
  $('#sec-linha').hidden = !atual.id;
  $('#linha').innerHTML = [...(atual.linha || [])].reverse().map((l) => `<li data-origem="${l.origem}">
    <time datetime="${l.data}">${new Date(l.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${l.origem === 'claude' ? ' · Claude' : ''}</time>
    <span>${esc(l.texto)}</span>
  </li>`).join('');
}

/* Propostas e faturas do painel com o mesmo nome de cliente. */
function desenharDocs() {
  const nome = (atual.nome || '').toLowerCase();
  const bate = (v) => nome && String(v || '').toLowerCase().includes(nome);
  const itens = [
    ...docs.propostas.filter((p) => bate(p.cliente)).map((p) => `<li><a href="/admin/propostas/#${esc(p.id)}">Proposta: ${esc(p.titulo || p.cliente)}</a> <small>${p.publicada ? 'no ar' : 'rascunho'}</small></li>`),
    ...docs.faturas.filter((f) => bate(f.cliente)).map((f) => `<li><a href="/faturas/${esc(f.id)}" target="_blank" rel="noopener">Fatura ${esc(f.codigo || '')}: ${esc(f.servico)}</a> <small>${f.paga ? 'paga' : 'em aberto'}</small></li>`),
  ];
  $('#sec-docs').hidden = !itens.length;
  $('#docs').innerHTML = itens.join('');
}

$('#atividades').addEventListener('change', (e) => {
  const i = e.target.dataset.i;
  if (i === undefined) return;
  atual.atividades[i].estado = e.target.value;
  desenharAtividades();
});

$('#add-ativ').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#nova-ativ').value.trim();
  if (!t) return;
  atual.atividades = [...(atual.atividades || []), { titulo: t, estado: 'semana', origem: 'painel' }];
  $('#nova-ativ').value = '';
  desenharAtividades();
});

$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements;
  const dado = { id: atual.id, atividades: atual.atividades };
  for (const campo of ['nome', 'etapa', 'servico', 'proximoPasso', 'contato', 'notas']) dado[campo] = f[campo].value;
  try {
    const salvo = await pedir('/api/crm', { method: 'POST', body: JSON.stringify(dado) });
    guardar(salvo);
    $('#ficha').close();
    avisar('Cliente salvo.');
  } catch (err) { avisar(err.message, 'erro'); }
});

$('#add-linha').addEventListener('submit', async (e) => {
  e.preventDefault();
  const texto = $('#nova-linha').value.trim();
  if (!texto || !atual.id) return;
  try {
    const salvo = await pedir(`/api/crm/${atual.id}/linha`, { method: 'POST', body: JSON.stringify({ texto }) });
    guardar(salvo);
    atual.linha = salvo.linha;
    $('#nova-linha').value = '';
    desenharLinha();
  } catch (err) { avisar(err.message, 'erro'); }
});

$('#fechar').onclick = () => $('#ficha').close();
$('#novo').onclick = () => abrir(null);
$('#busca').addEventListener('input', desenhar);

carregar().catch((e) => { $('#funil').innerHTML = `<p class="vazio">${esc(e.message)}</p>`; });
// Documentos do painel: se falhar, a ficha só não mostra a seção.
Promise.all([fetch('/api/propostas'), fetch('/api/faturas')])
  .then(async ([rp, rf]) => { docs = { propostas: (await rp.json()).propostas || [], faturas: (await rf.json()).faturas || [] }; })
  .catch(() => {});
