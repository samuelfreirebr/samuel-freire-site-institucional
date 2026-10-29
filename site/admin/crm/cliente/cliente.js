/* Ficha do cliente em página própria: /admin/crm/cliente/#<id>
   (ou #<id>&<aba> para abrir direto numa aba). Tudo salva na hora;
   os dados de cadastro, pelo "Editar dados". */

import {
  $, $$, esc, avisar, salvarCliente, anotar, carregarCrm, normalizar, documentos, mesmoCliente, NOMES, LEADS,
  hojeIso, dataCurta, dataLonga, diasAte, quando, prazoTexto, iniciais, abertas, atrasadas, proximaEntrega, projetoAtual,
  diasNaEtapa, situacaoLead, ordenarTarefas, linhaTarefa, ligarLista, abrirTarefa, ligarBusca, copiar,
} from '../comum.js';

const [id, abaInicial] = decodeURIComponent(location.hash.slice(1)).split('&');
let c = null, todos = [], etapas = [], origens = [], estadosProjeto = [], docs = { propostas: [], formularios: [] };
const CAMPOS = ['nome', 'servico', 'proximoPasso', 'contato', 'origemLead', 'proximoContato', 'motivoPerda', 'tipo', 'inicio', 'fim'];
// Materiais que quase todo projeto pede. Clique para pôr na lista.
const SUGESTOES = ['Logo em alta', 'Fotos', 'Textos', 'Acesso ao domínio', 'Acesso à hospedagem', 'Identidade visual', 'Depoimentos', 'Redes sociais'];

function guardar(salvo) {
  c = normalizar(salvo);
  const i = todos.findIndex((x) => x.id === c.id);
  if (i >= 0) todos[i] = c;
  desenhar();
}
const salvar = async (dado) => guardar(await salvarCliente({ id: c.id, ...dado }));
const tarefasDaqui = () => ordenarTarefas((c.atividades || []).map((t) => ({ ...t, cliente: c })));
const nova = (extra = {}) => abrirTarefa({ cliente: c, clientes: todos, aoSalvar: guardar, ...extra });

/* ---------- cabeçalho ---------- */

function desenharCabecalho() {
  document.title = `${c.nome} | CRM Samuel Freire`;
  $('#topo-nome').textContent = c.nome;
  $('#avatar').textContent = iniciais(c.nome);
  $('#nome').textContent = c.nome;
  $('#servico').textContent = [c.servico || 'Sem serviço na ficha', c.contato].filter(Boolean).join(' · ');
  $('#etapa').value = c.etapa;
  $('#ficha').dataset.etapa = c.etapa;

  const lead = LEADS.includes(c.etapa), s = situacaoLead(c), prox = proximaEntrega(c);
  const bloco = (rotulo, valor, apoio, alerta = false) => `<div class="fc-meta__item${alerta ? ' alerta' : ''}"><span>${rotulo}</span><b>${valor}</b><small>${apoio}</small></div>`;
  let vig = bloco('Vigência', 'Sem datas', c.tipo ? (c.tipo === 'recorrente' ? 'Recorrente' : 'Pontual') : 'Use "Editar dados"');
  if (c.fim) {
    const d = diasAte(c.fim);
    vig = bloco('Vigência', `até ${dataLonga(c.fim)}`, d < 0 ? `Venceu há ${-d} dia${d < -1 ? 's' : ''}` : d === 0 ? 'Vence hoje' : `Vence em ${d} dia${d > 1 ? 's' : ''}`, d <= 30);
  } else if (c.inicio) vig = bloco('Vigência', `desde ${dataLonga(c.inicio)}`, 'Sem data de fim');
  $('#meta').innerHTML = [
    bloco('Na etapa', `${diasNaEtapa(c)} dia${diasNaEtapa(c) === 1 ? '' : 's'}`, etapas.find((e) => e.id === c.etapa)?.nome || ''),
    lead ? bloco('Follow-up', c.proximoContato ? prazoTexto(c.proximoContato) : 'Sem data', s ? esc(s.texto) : '', Boolean(s?.alerta))
      : bloco('Próxima entrega', prox ? prazoTexto(prox.prazo) : 'Nenhuma', prox ? esc(prox.titulo) : 'Sem prazo marcado'),
    lead ? bloco('Origem', c.origemLead ? NOMES.origem[c.origemLead] : 'Não informada', c.motivoPerda ? esc(c.motivoPerda) : 'De onde veio') : vig,
    bloco('Tarefas abertas', abertas(c).length, atrasadas(c).length ? `${atrasadas(c).length} atrasada${atrasadas(c).length > 1 ? 's' : ''}` : 'Nenhuma atrasada', atrasadas(c).length > 0),
  ].join('');

  const contar = (sel, n) => { $(sel).textContent = n || ''; };
  contar('#n-tarefas', abertas(c).length);
  contar('#n-projetos', c.projetos.length);
  contar('#n-materiais', c.materiais.filter((m) => m.estado === 'falta').length && `${c.materiais.filter((m) => m.estado === 'falta').length} faltando`);
  contar('#n-notas', (c.linha || []).filter((l) => l.tipo === 'nota').length + (c.notas ? 1 : 0));
}

/* ---------- Resumo ---------- */

function desenharResumo() {
  $('#passo').textContent = c.proximoPasso || 'Nenhum próximo passo. Clique em "Mudar" e escreva o que precisa acontecer agora.';
  $('#passo').classList.toggle('vazio', !c.proximoPasso);
  $('#resumo-tarefas').innerHTML = tarefasDaqui().filter((t) => t.estado !== 'feita').slice(0, 6).map((t) => linhaTarefa(t, { mostrarCliente: false })).join('')
    || '<li class="vazio">Nenhuma tarefa aberta.</li>';

  const forms = docs.formularios.filter((f) => mesmoCliente(c.nome, f.cliente || f.titulo));
  const falta = [
    ...atrasadas(c).map((a) => ({ txt: a.titulo, apoio: `Atrasada desde ${dataCurta(a.prazo)}`, alerta: true })),
    ...(situacaoLead(c)?.alerta ? [{ txt: 'Falar com o lead', apoio: situacaoLead(c).texto, alerta: true }] : []),
    ...c.materiais.filter((m) => m.estado === 'falta').map((m) => ({ txt: `Material: ${m.nome}`, apoio: 'Ainda não chegou' })),
    ...forms.filter((f) => !f.respondidoEm).map((f) => ({ txt: 'Briefing sem resposta', apoio: f.titulo || 'Formulário enviado' })),
  ];
  if (!c.proximoPasso) falta.push({ txt: 'Definir o próximo passo', apoio: 'Ninguém sabe o que vem agora' });
  $('#falta').innerHTML = falta.slice(0, 8).map((f) => `<li><span class="fc-falta${f.alerta ? ' atraso' : ''}">
      <span class="crm-lista__txt"><b>${esc(f.txt)}</b><small>${esc(f.apoio || '')}</small></span></span></li>`).join('')
    || '<li class="vazio">Nada pendente. Tudo em dia.</li>';

  const p = projetoAtual(c);
  $('#projeto-atual').innerHTML = p
    ? `<p class="fc-proj-nome">${esc(p.nome)}</p><p class="fc-dica">${NOMES.projeto[p.estado]}${p.prazo ? ` · prazo ${dataLonga(p.prazo)}` : ''} · ${c.atividades.filter((t) => t.projeto === p.id && t.estado !== 'feita').length} tarefa(s) abertas</p>`
    : '<p class="vazio">Nenhum projeto em andamento.</p>';

  $('#ultimas').innerHTML = [...(c.linha || [])].reverse().slice(0, 4).map((l) => `<li><span class="crm-lista__txt"><b>${esc(l.texto)}</b><small>${quando(l.data)}${l.origem === 'claude' ? ' · Claude' : ''}</small></span></li>`).join('');
}

/* ---------- Tarefas ---------- */

function desenharTarefas() {
  const feitas = $('#ver-feitas').checked;
  $('#tarefas').innerHTML = tarefasDaqui().filter((t) => feitas || t.estado !== 'feita').map((t) => linhaTarefa(t, { mostrarCliente: false })).join('')
    || '<li class="vazio">Nenhuma tarefa. Use "Nova tarefa".</li>';
}

/* ---------- Projetos ---------- */

function desenharProjetos() {
  const ops = (sel) => estadosProjeto.map((e) => `<option value="${e}"${e === sel ? ' selected' : ''}>${NOMES.projeto[e]}</option>`).join('');
  $('#add-projeto').elements.estado.innerHTML = ops('proximo');
  $('#projetos').innerHTML = c.projetos.map((p, i) => {
    const ts = c.atividades.filter((t) => t.projeto === p.id);
    const feitas = ts.filter((t) => t.estado === 'feita').length;
    return `<article class="crm-card-box fc-proj" data-i="${i}" data-estado="${p.estado}">
      <div class="crm-box__topo"><h3>${esc(p.nome)}</h3><select data-campo="estado" aria-label="Situação de ${esc(p.nome)}">${ops(p.estado)}</select></div>
      <div class="fc-proj__datas">
        <label><span>Início</span><input type="date" data-campo="inicio" value="${p.inicio}"></label>
        <label><span>Prazo</span><input type="date" data-campo="prazo" value="${p.prazo}"></label>
      </div>
      <div class="fc-proj__barra" title="${feitas} de ${ts.length} tarefas feitas"><span style="width:${ts.length ? (feitas / ts.length) * 100 : 0}%"></span></div>
      <p class="fc-dica">${ts.length ? `${feitas} de ${ts.length} tarefas feitas` : 'Nenhuma tarefa neste projeto ainda'}${p.prazo && p.estado !== 'entregue' && p.prazo < hojeIso() ? ' · <b class="claude">prazo passou</b>' : ''}</p>
      <ul class="tf-lista tf-lista--compacta">${ts.filter((t) => t.estado !== 'feita').map((t) => linhaTarefa({ ...t, cliente: c }, { mostrarCliente: false })).join('')}</ul>
      <button class="mini" type="button" data-nova-no-projeto="${p.id}">Nova tarefa neste projeto</button>
    </article>`;
  }).join('') || '<p class="vazio">Nenhum projeto ainda. Projeto é um trabalho com começo e fim dentro do cliente, como "LP Mentoria Alpha".</p>';
}

/* ---------- Materiais ---------- */

function desenharMateriais() {
  $('#materiais').innerHTML = c.materiais.map((m, i) => `<li data-i="${i}" data-estado="${m.estado}">
      <label class="fc-mat__check"><input type="checkbox" data-campo="recebido"${m.estado === 'recebido' ? ' checked' : ''}> <span>${esc(m.nome)}</span></label>
      <span class="fc-mat__estado">${m.estado === 'recebido' ? 'Recebido' : 'Falta'}</span>
      <input type="text" data-campo="link" value="${esc(m.link)}" placeholder="Link do Drive ou do arquivo" aria-label="Link de ${esc(m.nome)}">
      ${m.link ? `<a class="mini" href="${esc(m.link)}" target="_blank" rel="noopener">Abrir</a>` : '<span></span>'}
    </li>`).join('') || '<li class="vazio">Nenhum material na lista. Use as sugestões abaixo ou escreva um.</li>';
  const tem = new Set(c.materiais.map((m) => m.nome.toLowerCase()));
  const faltam = SUGESTOES.filter((s) => !tem.has(s.toLowerCase()));
  $('#sugestoes').innerHTML = faltam.length ? '<span>Sugestões:</span>' + faltam.map((s) => `<button class="mini" type="button" data-sugestao="${esc(s)}">+ ${esc(s)}</button>`).join('') : '';
}

/* ---------- Briefing e proposta ---------- */

function desenharBriefing() {
  const props = docs.propostas.filter((p) => mesmoCliente(c.nome, p.cliente));
  const forms = docs.formularios.filter((f) => mesmoCliente(c.nome, f.cliente || f.titulo));
  const caixa = (titulo, acao, itens, vazio) => `<article class="crm-card-box"><div class="crm-box__topo"><h3>${titulo}</h3>${acao}</div>
      <ul class="crm-lista">${itens.join('') || `<li class="vazio">${vazio}</li>`}</ul></article>`;
  $('#briefing').innerHTML = [
    caixa('Briefings', '<a class="mini mini--ativo" href="/admin/formularios/" target="_blank" rel="noopener">Criar briefing</a>', forms.map((f) => `<li class="fc-doc">
        <span class="crm-lista__txt"><b>${esc(f.titulo || 'Briefing')}</b><small>${f.perguntas} pergunta${f.perguntas === 1 ? '' : 's'} · ${f.respondidoEm ? `respondido ${quando(f.respondidoEm)}` : f.parciais ? 'cliente começou a responder' : 'sem resposta'}</small></span>
        <span class="fc-doc__acoes"><button class="mini" type="button" data-copiar-link="${esc(f.link)}">Copiar link</button><a class="mini" href="/admin/formularios/" target="_blank" rel="noopener">Ver respostas</a></span>
      </li>`), 'Nenhum briefing com o nome deste cliente. "Criar briefing" monta um a partir da proposta ou em branco.'),
    caixa('Propostas', '<a class="mini" href="/admin/propostas/" target="_blank" rel="noopener">Abrir propostas</a>', props.map((p) => `<li><a href="/admin/propostas/#${encodeURIComponent(p.id)}" target="_blank" rel="noopener">
        <span class="crm-lista__txt"><b>${esc(p.titulo || p.cliente)}</b><small>${p.publicada ? 'No ar' : 'Rascunho'}${p.briefing?.respondidoEm ? ' · briefing respondido' : ''}</small></span></a></li>`), 'Nenhuma proposta com o nome deste cliente.'),
  ].join('');
}

/* ---------- Notas e linha do tempo ---------- */

const itemLinha = (l) => `<li data-origem="${l.origem}" data-tipo="${l.tipo || 'evento'}">
    <time datetime="${l.data}">${new Date(l.data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}${l.origem === 'claude' ? ' · Claude' : ''}${l.tipo === 'nota' ? ' · Nota' : ''}</time>
    <span>${esc(l.texto)}</span></li>`;

function desenharNotas() {
  const notas = [...(c.linha || [])].filter((l) => l.tipo === 'nota').reverse();
  $('#notas').innerHTML = notas.map(itemLinha).join('')
    + (c.notas ? `<li data-tipo="nota"><time>Anotação antiga da ficha</time><span>${esc(c.notas)}</span></li>` : '')
    || '<li class="vazio">Nenhuma nota ainda.</li>';
  $('#linha').innerHTML = [...(c.linha || [])].reverse().map(itemLinha).join('');
}

function desenhar() { desenharCabecalho(); desenharResumo(); desenharTarefas(); desenharProjetos(); desenharMateriais(); desenharBriefing(); desenharNotas(); }

/* ---------- ações ---------- */

function irPara(aba) {
  if (!$(`[data-painel="${aba}"]`)) aba = 'resumo';
  $$('[data-aba]').forEach((x) => x.setAttribute('aria-selected', String(x.dataset.aba === aba)));
  $$('[data-painel]').forEach((p) => { p.hidden = p.dataset.painel !== aba; });
  history.replaceState(null, '', `#${c.id}${aba === 'resumo' ? '' : '&' + aba}`);
}

function ligar() {
  $$('[data-aba]').forEach((b) => b.addEventListener('click', () => irPara(b.dataset.aba)));
  $('#ficha').addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir]');
    if (ir) irPara(ir.dataset.ir);
    if (e.target.closest('[data-nova-tarefa]')) nova();
    const np = e.target.closest('[data-nova-no-projeto]');
    if (np) nova({ projeto: np.dataset.novaNoProjeto });
    if (e.target.closest('[data-editar-passo]')) {
      const v = prompt('Próximo passo:', c.proximoPasso || '');
      if (v !== null) salvar({ proximoPasso: v }).catch((err) => avisar(err.message, 'erro'));
    }
  });

  $('#etapa').addEventListener('change', (e) => salvar({ etapa: e.target.value }).then(() => avisar('Etapa atualizada.')).catch((err) => avisar(err.message, 'erro')));
  for (const raiz of ['#resumo-tarefas', '#tarefas', '#projetos']) ligarLista($(raiz), { achar: () => c, aoSalvar: guardar, clientes: () => todos });
  $('#ver-feitas').addEventListener('change', desenharTarefas);

  // Projetos: situação e datas salvam ao mudar.
  $('#projetos').addEventListener('change', (e) => {
    const campo = e.target.dataset.campo, card = e.target.closest('.fc-proj');
    if (!campo || !card) return;
    const projetos = structuredClone(c.projetos);
    projetos[card.dataset.i][campo] = e.target.value;
    salvar({ projetos }).catch((err) => avisar(err.message, 'erro'));
  });
  $('#add-projeto').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    try {
      await salvar({ projetos: [...c.projetos, { nome: f.nome.value, estado: f.estado.value, prazo: f.prazo.value, inicio: f.estado.value === 'andamento' ? hojeIso() : '' }] });
      e.target.reset();
      avisar('Projeto criado.');
    } catch (err) { avisar(err.message, 'erro'); }
  });

  // Materiais: marcar recebido e colar o link salvam na hora.
  $('#materiais').addEventListener('change', (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li) return;
    const materiais = structuredClone(c.materiais), m = materiais[li.dataset.i];
    if (e.target.dataset.campo === 'recebido') m.estado = e.target.checked ? 'recebido' : 'falta';
    if (e.target.dataset.campo === 'link') {
      const v = e.target.value.trim();
      if (v && !/^https?:\/\//i.test(v)) return avisar('O link precisa começar com http:// ou https://.', 'erro');
      m.link = v;
    }
    salvar({ materiais }).catch((err) => avisar(err.message, 'erro'));
  });
  const addMaterial = (nome, link = '') => salvar({ materiais: [...c.materiais, { nome, link, estado: 'falta' }] }).catch((err) => avisar(err.message, 'erro'));
  $('#sugestoes').addEventListener('click', (e) => { const b = e.target.closest('[data-sugestao]'); if (b) addMaterial(b.dataset.sugestao); });
  $('#add-material').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target.elements;
    if (f.link.value.trim() && !/^https?:\/\//i.test(f.link.value.trim())) return avisar('O link precisa começar com http:// ou https://.', 'erro');
    await addMaterial(f.nome.value.trim(), f.link.value.trim());
    e.target.reset();
  });
  $('#pedir-materiais').addEventListener('click', () => {
    const faltam = c.materiais.filter((m) => m.estado === 'falta');
    if (!faltam.length) return avisar('Nada faltando na lista de materiais.');
    const primeiro = (c.contato || '').split(/[,·-]/)[0].trim();
    copiar(`Oi${primeiro ? ', ' + primeiro : ''}! Para seguir com o projeto, ainda preciso de:\n\n${faltam.map((m) => `• ${m.nome}`).join('\n')}\n\nPode mandar por aqui mesmo ou numa pasta do Drive. Obrigado!`,
      'Mensagem copiada. Cole no WhatsApp do cliente.');
  });

  $('#briefing').addEventListener('click', (e) => {
    const b = e.target.closest('[data-copiar-link]');
    if (b) copiar(`${location.origin}/perguntas/${b.dataset.copiarLink}`, 'Link do briefing copiado.');
  });

  $('#add-nota').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      guardar(await anotar(c.id, e.target.elements.texto.value.trim(), 'nota'));
      e.target.reset();
      avisar('Nota guardada.');
    } catch (err) { avisar(err.message, 'erro'); }
  });
}

$('#editar').onclick = () => {
  if (!c) return;
  const f = $('#form').elements;
  for (const k of CAMPOS) f[k].value = c[k] ?? '';
  $('#jan').showModal();
};
$('#jan [data-fechar]').onclick = () => $('#jan').close();
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, dado = {};
  for (const k of CAMPOS) dado[k] = f[k].value;
  try { await salvar(dado); $('#jan').close(); avisar('Dados salvos.'); }
  catch (err) { avisar(err.message, 'erro'); }
});

async function carregar() {
  const [d, ds] = await Promise.all([carregarCrm(), documentos()]);
  todos = d.clientes; etapas = d.etapas; origens = d.origens || []; estadosProjeto = d.estadosProjeto || []; docs = ds;
  const achado = todos.find((x) => x.id === id);
  if (!achado) {
    $('#ficha').innerHTML = '<p class="vazio">Cliente não encontrado. <a href="/admin/crm/#clientes">Voltar para a lista</a>.</p>';
    $('#editar').hidden = true;
    return;
  }
  const primeira = !c;
  c = achado;
  if (primeira) {
    $('#ficha').replaceChildren($('#modelo').content.cloneNode(true));
    $('#etapa').innerHTML = etapas.map((e) => `<option value="${e.id}">${esc(e.nome)}</option>`).join('');
    $('#f-origem').innerHTML = '<option value="">Não informada</option>' + origens.map((o) => `<option value="${o}">${NOMES.origem[o] || o}</option>`).join('');
    ligar();
    irPara(abaInicial || 'resumo');
  }
  desenhar();
}

$('#buscar').onclick = ligarBusca(() => todos);
carregar().catch((e) => { $('#ficha').innerHTML = `<p class="vazio">${esc(e.message)}</p>`; });
// O Claude pode ter mexido enquanto a aba estava em segundo plano.
addEventListener('focus', () => { if (c && !document.querySelector('dialog[open]') && !document.activeElement?.matches('input, textarea')) carregar().catch(() => {}); });
addEventListener('hashchange', () => { if (decodeURIComponent(location.hash.slice(1)).split('&')[0] !== c?.id) location.reload(); });
