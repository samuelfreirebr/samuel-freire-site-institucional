/* Ficha do cliente em página própria: /admin/crm/cliente/#<id>.
   Abas Resumo, Documentos e Linha do tempo. Atividade e etapa salvam
   na hora; o resto dos dados, pelo "Editar dados". */

import {
  $, esc, avisar, pedir, documentos, mesmoCliente, dinheiro, hojeIso, dataCurta, diasAte, quando,
  abertas, atrasadas, proximaEntrega, iniciais, NOMES_ESTADO,
} from '../comum.js';

const id = decodeURIComponent(location.hash.slice(1));
let c = null, etapas = [], estados = [], docs = { propostas: [], faturas: [], formularios: [] };
const CAMPOS = ['nome', 'servico', 'proximoPasso', 'contato', 'tipo', 'valor', 'moeda', 'inicio', 'fim', 'notas'];

async function salvar(dado) {
  c = await pedir('/api/crm', { method: 'POST', body: JSON.stringify({ id: c.id, ...dado }) });
  desenhar();
}

/* ---------- cabeçalho e números ---------- */

function desenharCabecalho() {
  document.title = `${c.nome} | CRM Samuel Freire`;
  $('#topo-nome').textContent = c.nome;
  $('#avatar').textContent = iniciais(c.nome);
  $('#nome').textContent = c.nome;
  $('#servico').textContent = c.servico || 'Sem serviço na ficha. Use "Editar dados".';
  $('#etapa').value = c.etapa;
  $('#ficha').dataset.etapa = c.etapa;

  let vigencia = 'Sem datas', apoioVig = c.inicio ? `Desde ${c.inicio.split('-').reverse().join('/')}` : 'Use "Editar dados"', alerta = false;
  if (c.fim) {
    const d = diasAte(c.fim);
    vigencia = `até ${c.fim.split('-').reverse().join('/')}`;
    apoioVig = d < 0 ? `Venceu há ${-d} dia${d < -1 ? 's' : ''}` : d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d > 1 ? 's' : ''}`;
    alerta = d <= 30;
  } else if (c.inicio) vigencia = 'Sem data de fim';
  const prox = proximaEntrega(c);
  const bloco = (rotulo, valor, apoio, extra = '') => `<div class="fc-meta__item${extra}"><span>${rotulo}</span><b>${valor}</b><small>${apoio}</small></div>`;
  $('#meta').innerHTML = [
    bloco('Contrato', c.valor != null ? dinheiro(c.valor, c.moeda) : 'Sem valor', c.tipo === 'recorrente' ? 'Recorrente, por mês' : c.tipo === 'pontual' ? 'Pontual, por projeto' : 'Tipo não definido'),
    bloco('Vigência', vigencia, apoioVig, alerta ? ' alerta' : ''),
    bloco('Próxima entrega', prox ? dataCurta(prox.prazo) : 'Nenhuma', prox ? esc(prox.titulo) : 'Sem prazo marcado'),
    bloco('Contato', c.contato ? esc(c.contato) : 'Sem contato', `Atualizado ${quando(c.atualizadoEm)}`),
  ].join('');
}

/* ---------- Resumo ---------- */

function desenharResumo() {
  $('#passo').textContent = c.proximoPasso || 'Nenhum próximo passo. Use "Editar dados" para escrever o que precisa acontecer agora.';
  $('#passo').classList.toggle('vazio', !c.proximoPasso);
  $('#notas').textContent = c.notas || 'Sem notas.';
  $('#notas').classList.toggle('vazio', !c.notas);

  const lista = [...(c.atividades || [])].map((a, i) => ({ ...a, i }))
    .sort((x, y) => (x.estado === 'feita') - (y.estado === 'feita') || (x.prazo || '9').localeCompare(y.prazo || '9'));
  const ops = (sel) => estados.map((s) => `<option value="${s}"${s === sel ? ' selected' : ''}>${NOMES_ESTADO[s] || s}</option>`).join('');
  $('#n-ativ').textContent = `${abertas(c).length} aberta${abertas(c).length === 1 ? '' : 's'}`;
  $('#atividades').innerHTML = lista.map((a) => `<li data-feita="${a.estado === 'feita' ? 1 : 0}">
      <span class="fc-ativ__prazo${a.prazo && a.prazo < hojeIso() && a.estado !== 'feita' ? ' atraso' : ''}">${a.prazo ? dataCurta(a.prazo) : 'Sem prazo'}</span>
      <span class="fc-ativ__txt">${esc(a.titulo)}${a.origem === 'claude' ? ' <i class="claude">Claude</i>' : ''}</span>
      <select data-i="${a.i}" aria-label="Situação de: ${esc(a.titulo)}">${ops(a.estado)}</select>
    </li>`).join('') || '<li class="vazio">Nenhuma atividade. Adicione a primeira abaixo.</li>';

  // O que falta: atrasadas, briefing sem resposta e fatura em aberto.
  const falta = [
    ...atrasadas(c).map((a) => ({ txt: a.titulo, apoio: `Atrasada desde ${dataCurta(a.prazo)}`, alerta: true })),
    ...docs.formularios.filter((f) => mesmoCliente(c.nome, f.cliente || f.titulo) && !f.respondidoEm).map((f) => ({ txt: 'Briefing sem resposta', apoio: f.titulo || 'Formulário enviado' })),
    ...docs.faturas.filter((f) => mesmoCliente(c.nome, f.cliente) && !f.paga).map((f) => ({ txt: `Fatura em aberto: ${dinheiro(f.valor, f.moeda)}`, apoio: f.vencimento ? `Vence ${dataCurta(f.vencimento)}` : f.servico })),
  ];
  if (!c.proximoPasso) falta.push({ txt: 'Definir o próximo passo', apoio: 'Ninguém sabe o que vem agora' });
  $('#falta').innerHTML = falta.map((f) => `<li><span class="fc-falta${f.alerta ? ' atraso' : ''}">
      <span class="crm-lista__txt"><b>${esc(f.txt)}</b><small>${esc(f.apoio || '')}</small></span></span></li>`).join('')
    || '<li class="vazio">Nada pendente. Tudo em dia.</li>';

  $('#ultimas').innerHTML = [...(c.linha || [])].reverse().slice(0, 4).map((l) => `<li><span class="fc-falta">
      <span class="crm-lista__txt"><b>${esc(l.texto)}</b><small>${quando(l.data)}${l.origem === 'claude' ? ' · Claude' : ''}</small></span></span></li>`).join('');
}

/* ---------- Documentos ---------- */

function desenharDocumentos() {
  const props = docs.propostas.filter((p) => mesmoCliente(c.nome, p.cliente));
  const fats = docs.faturas.filter((f) => mesmoCliente(c.nome, f.cliente));
  const forms = docs.formularios.filter((f) => mesmoCliente(c.nome, f.cliente || f.titulo));
  $('#n-docs').textContent = props.length + fats.length + forms.length || '';
  const caixa = (titulo, itens, vazio, novo) => `<article class="crm-card-box">
      <div class="crm-box__topo"><h3>${titulo}</h3><a class="mini" href="${novo}" target="_blank" rel="noopener">Abrir</a></div>
      <ul class="crm-lista">${itens.join('') || `<li class="vazio">${vazio}</li>`}</ul>
    </article>`;
  const linha = (href, txt, apoio, estado) => `<li><a href="${href}" target="_blank" rel="noopener">
      <span class="crm-lista__txt"><b>${esc(txt)}</b><small>${esc(apoio)}</small></span>
      <span class="crm-lista__quando">${estado}</span></a></li>`;
  $('#docs').innerHTML = [
    caixa('Propostas', props.map((p) => linha(`/admin/propostas/#${encodeURIComponent(p.id)}`, p.titulo || p.cliente, p.cliente, p.publicada ? 'No ar' : 'Rascunho')), 'Nenhuma proposta com este nome.', '/admin/propostas/'),
    caixa('Faturas', fats.map((f) => linha(`/faturas/${encodeURIComponent(f.id)}`, `${f.codigo || 'Fatura'}: ${dinheiro(f.valor, f.moeda)}`, f.servico || '', f.paga ? 'Paga' : '<i>Em aberto</i>')), 'Nenhuma fatura com este nome.', '/admin/faturas/'),
    caixa('Briefings', forms.map((f) => linha(`/perguntas/${encodeURIComponent(f.link)}`, f.titulo || 'Briefing', `${f.perguntas} pergunta${f.perguntas === 1 ? '' : 's'}`, f.respondidoEm ? 'Respondido' : '<i>Sem resposta</i>')), 'Nenhum briefing com este nome.', '/admin/formularios/'),
  ].join('');
}

/* ---------- Linha do tempo ---------- */

function desenharLinha() {
  $('#linha').innerHTML = [...(c.linha || [])].reverse().map((l) => `<li data-origem="${l.origem}">
      <time datetime="${l.data}">${new Date(l.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${l.origem === 'claude' ? ' · Claude' : ''}</time>
      <span>${esc(l.texto)}</span>
    </li>`).join('');
}

function desenhar() { desenharCabecalho(); desenharResumo(); desenharDocumentos(); desenharLinha(); }

/* ---------- ações ---------- */

function ligar() {
  document.querySelectorAll('[data-aba]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('[data-aba]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== b.dataset.aba; });
  }));

  $('#etapa').addEventListener('change', (e) => salvar({ etapa: e.target.value }).then(() => avisar('Etapa atualizada.')).catch((err) => avisar(err.message, 'erro')));

  $('#atividades').addEventListener('change', (e) => {
    const i = e.target.dataset.i;
    if (i === undefined) return;
    const atividades = structuredClone(c.atividades);
    atividades[i].estado = e.target.value;
    salvar({ atividades }).catch((err) => avisar(err.message, 'erro'));
  });

  $('#add-ativ').addEventListener('submit', async (e) => {
    e.preventDefault();
    const titulo = $('#nova-ativ').value.trim();
    if (!titulo) return;
    try {
      await salvar({ atividades: [...(c.atividades || []), { titulo, prazo: $('#nova-prazo').value, estado: 'semana', origem: 'painel' }] });
      $('#nova-ativ').value = ''; $('#nova-prazo').value = '';
      $('#nova-ativ').focus();
    } catch (err) { avisar(err.message, 'erro'); }
  });

  $('#add-linha').addEventListener('submit', async (e) => {
    e.preventDefault();
    const texto = $('#nova-linha').value.trim();
    if (!texto) return;
    try {
      c = await pedir(`/api/crm/${c.id}/linha`, { method: 'POST', body: JSON.stringify({ texto }) });
      $('#nova-linha').value = '';
      desenhar();
    } catch (err) { avisar(err.message, 'erro'); }
  });
}

$('#editar').onclick = () => {
  if (!c) return;
  const f = $('#form').elements;
  for (const k of CAMPOS) f[k].value = c[k] ?? '';
  $('#jan').showModal();
};
$('#fechar').onclick = () => $('#jan').close();
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, dado = {};
  for (const k of CAMPOS) dado[k] = f[k].value;
  try { await salvar(dado); $('#jan').close(); avisar('Dados salvos.'); }
  catch (err) { avisar(err.message, 'erro'); }
});

async function carregar() {
  const [d, ds] = await Promise.all([pedir('/api/crm'), documentos()]);
  etapas = d.etapas; estados = d.estados; docs = ds;
  const achado = d.clientes.find((x) => x.id === id);
  if (!achado) {
    $('#ficha').innerHTML = '<p class="vazio">Cliente não encontrado. <a href="/admin/crm/#clientes">Voltar para a lista</a>.</p>';
    $('#editar').hidden = true;
    return;
  }
  c = achado;
  if (!$('#etapa')) {
    $('#ficha').replaceChildren($('#modelo').content.cloneNode(true));
    $('#etapa').innerHTML = etapas.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
    ligar();
  }
  desenhar();
}

carregar().catch((e) => { $('#ficha').innerHTML = `<p class="vazio">${esc(e.message)}</p>`; });
// O Claude pode ter mexido enquanto a aba estava em segundo plano.
addEventListener('focus', () => { if (c) carregar().catch(() => {}); });
addEventListener('hashchange', () => location.reload());
