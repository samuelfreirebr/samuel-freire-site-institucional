/* Ficha do cliente em página própria: /admin/crm/cliente/#<id>
   (ou #<id>&<aba> para abrir direto numa aba). Tudo salva na hora;
   os dados de cadastro, pelo "Editar dados". */

import {
  $, $$, esc, avisar, salvarCliente, anotar, carregarCrm, normalizar, documentos, mesmoCliente, NOMES, LEADS,
  dataCurta, quando, prazoTexto, iniciais, selo, whatsapp, abertas, atrasadas, proximaTarefa,
  diasNaEtapa, situacaoLead, ordenarTarefas, linhaTarefa, tarefasClickup, ligarLista, abrirTarefa, ligarBusca, copiar,
} from '../comum.js';

const [id, abaInicial] = decodeURIComponent(location.hash.slice(1)).split('&');
let c = null, todos = [], etapas = [], origens = [], docs = { propostas: [], formularios: [] };
const CAMPOS = ['nome', 'servico', 'contato', 'origemLead', 'proximoContato', 'motivoPerda', 'tipo'];
// Materiais que quase todo cliente manda. Clique para pôr na lista.
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
  $('#nome').innerHTML = esc(c.nome) + selo(c);
  const zap = whatsapp(c);
  $('#whats').hidden = !zap;
  if (zap) $('#whats').href = zap;
  $('#servico').textContent = [c.servico || 'Sem serviço na ficha', c.contato].filter(Boolean).join(' · ');
  $('#etapa').value = c.etapa;
  $('#ficha').dataset.etapa = c.etapa;

  const lead = LEADS.includes(c.etapa), s = situacaoLead(c), prox = proximaTarefa(c);
  const faltam = c.materiais.filter((m) => m.estado === 'falta').length;
  const bloco = (rotulo, valor, apoio, alerta = false) => `<div class="fc-meta__item${alerta ? ' alerta' : ''}"><span>${rotulo}</span><b>${valor}</b><small>${apoio}</small></div>`;
  $('#meta').innerHTML = [
    bloco('Na etapa', `${diasNaEtapa(c)} dia${diasNaEtapa(c) === 1 ? '' : 's'}`, etapas.find((e) => e.id === c.etapa)?.nome || ''),
    lead ? bloco('Follow-up', c.proximoContato ? prazoTexto(c.proximoContato) : 'Sem data', s ? esc(s.texto) : '', Boolean(s?.alerta))
      : bloco('Próxima tarefa', prox ? (prox.prazo ? prazoTexto(prox.prazo) : 'Sem prazo') : 'Nenhuma', prox ? esc(prox.titulo) : 'Nenhuma tarefa aberta'),
    lead ? bloco('Origem', c.origemLead ? NOMES.origem[c.origemLead] : 'Não informada', c.motivoPerda ? esc(c.motivoPerda) : 'De onde veio')
      : bloco('Materiais', faltam ? `${faltam} faltando` : 'Em dia', c.drive ? 'Pasta do Drive ligada' : 'Sem pasta do Drive', faltam > 0),
    bloco('Tarefas abertas', abertas(c).length, atrasadas(c).length ? `${atrasadas(c).length} atrasada${atrasadas(c).length > 1 ? 's' : ''}` : 'Nenhuma atrasada', atrasadas(c).length > 0),
  ].join('');

  const contar = (sel, n) => { $(sel).textContent = n || ''; };
  contar('#n-tarefas', abertas(c).length);
  contar('#n-materiais', c.materiais.filter((m) => m.estado === 'falta').length && `${c.materiais.filter((m) => m.estado === 'falta').length} faltando`);
  contar('#n-notas', (c.linha || []).filter((l) => l.tipo === 'nota').length + (c.notas ? 1 : 0));
}

/* ---------- Resumo ---------- */

function desenharResumo() {
  $('#resumo-tarefas').innerHTML = tarefasDaqui().filter((t) => t.estado !== 'feita').slice(0, 6).map((t) => linhaTarefa(t, { mostrarCliente: false })).join('')
    || '<li class="vazio">Nenhuma tarefa aberta.</li>';

  const forms = docs.formularios.filter((f) => mesmoCliente(c.nome, f.cliente || f.titulo));
  const falta = [
    ...atrasadas(c).map((a) => ({ txt: a.titulo, apoio: `Atrasada desde ${dataCurta(a.prazo)}`, alerta: true })),
    ...(situacaoLead(c)?.alerta ? [{ txt: 'Falar com o lead', apoio: situacaoLead(c).texto, alerta: true }] : []),
    ...c.materiais.filter((m) => m.estado === 'falta').map((m) => ({ txt: `Material: ${m.nome}`, apoio: 'Ainda não chegou' })),
    ...forms.filter((f) => !f.respondidoEm).map((f) => ({ txt: 'Briefing sem resposta', apoio: f.titulo || 'Formulário enviado' })),
  ];
  if (!abertas(c).length && !doClickup().length && !LEADS.includes(c.etapa) && c.etapa !== 'encerrado') falta.push({ txt: 'Nenhuma tarefa aberta', apoio: 'Crie a próxima tarefa deste cliente' });
  $('#falta').innerHTML = falta.slice(0, 8).map((f) => `<li><span class="fc-falta${f.alerta ? ' atraso' : ''}">
      <span class="crm-lista__txt"><b>${esc(f.txt)}</b><small>${esc(f.apoio || '')}</small></span></span></li>`).join('')
    || '<li class="vazio">Nada pendente. Tudo em dia.</li>';

  $('#ultimas').innerHTML = [...(c.linha || [])].reverse().slice(0, 4).map((l) => `<li><span class="crm-lista__txt"><b>${esc(l.texto)}</b><small>${quando(l.data)}${l.origem === 'claude' ? ' · Claude' : ''}</small></span></li>`).join('');
}

/* ---------- Tarefas ---------- */

function desenharTarefas() {
  const feitas = $('#ver-feitas').checked;
  $('#tarefas').innerHTML = tarefasDaqui().filter((t) => feitas || t.estado !== 'feita').map((t) => linhaTarefa(t, { mostrarCliente: false })).join('')
    || '<li class="vazio">Nenhuma tarefa. Use "Nova tarefa".</li>';
}

/* ---------- ClickUp (só leitura) ---------- */

let clickup = [];
async function buscarClickup() {
  clickup = await tarefasClickup(todos);
  desenharResumo();
  desenharClickup();
}

const doClickup = () => clickup.filter((t) => t.cliente.id === c.id);

function desenharClickup() {
  const daqui = doClickup().sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999'));
  for (const caixa of $$('[data-clickup]')) {
    caixa.hidden = !daqui.length;
    caixa.querySelector('.fc-cu-n').textContent = daqui.length;
  }
  $('#resumo-clickup').innerHTML = daqui.filter((t) => t.estado !== 'feita').slice(0, 6).map((t) => linhaTarefa(t, { mostrarCliente: false })).join('');
  $('#clickup').innerHTML = daqui.map((t) => linhaTarefa(t, { mostrarCliente: false })).join('');
}

/* ---------- Materiais ---------- */

function desenharMateriais() {
  const campo = $('#drive-form').elements.drive;
  if (document.activeElement !== campo) campo.value = c.drive || '';
  $('#drive-abrir').hidden = !c.drive;
  if (c.drive) $('#drive-abrir').href = c.drive;
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

/* ---------- Documentos: proposta, briefing e contrato ----------
   Valem as propostas ligadas ao cliente (c.propostas) e, enquanto não
   houver ligação, as que têm o mesmo nome. O briefing e o contrato de
   uma proposta usam o mesmo id dela. */

const contratos = {};   // id da proposta -> contrato (busca uma vez por proposta)
const ligadas = () => {
  const ids = new Set(c.propostas || []);
  return docs.propostas.filter((p) => ids.has(p.id) || (!ids.size && mesmoCliente(c.nome, p.cliente)));
};
const FASE = { preparo: 'Em preparo', enviada: 'Enviada', aprovada: 'Aprovada', contrato: 'Contrato enviado', assinado: 'Contrato assinado', briefing: 'Briefing enviado', producao: 'Em produção', entregue: 'Entregue' };

async function buscarContratos() {
  await Promise.all(ligadas().filter((p) => !(p.id in contratos)).map((p) =>
    fetch(`/api/contratos/${encodeURIComponent(p.id)}`).then((r) => (r.ok ? r.json() : {})).then((k) => { contratos[p.id] = k; }).catch(() => { contratos[p.id] = {}; })));
  desenharBriefing();
}

function desenharBriefing() {
  const props = ligadas();
  const ids = new Set(c.propostas || []);
  const forms = docs.formularios.filter((f) => props.some((p) => p.id === f.proposta || p.id === f.id) || (!props.length && mesmoCliente(c.nome, f.cliente || f.titulo)));
  const estado = (ok, sim, nao) => `<span class="fc-estado${ok ? ' ok' : ''}">${ok ? sim : nao}</span>`;
  const cartao = (p) => {
    const f = forms.find((x) => x.proposta === p.id || x.id === p.id);
    const k = contratos[p.id];
    const temContrato = Boolean(k?.texto);
    return `<article class="crm-card-box fc-prop">
      <div class="crm-box__topo"><h3>${esc(p.cliente || p.titulo)}</h3>${p.fase ? `<span class="crm-etapa" data-etapa="${p.fase === 'aprovada' || p.fase === 'assinado' ? 'andamento' : 'proposta'}">${FASE[p.fase] || p.fase}</span>` : ''}</div>
      <p class="fc-dica">${esc(p.titulo || '')}</p>
      <ol class="fc-trilha">
        <li>${estado(p.publicada, 'Proposta no ar', 'Proposta em rascunho')}
          <span><a class="mini" href="/admin/propostas/#${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Editar</a>${p.publicada ? `<a class="mini" href="/propostas/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Ver</a>` : ''}</span></li>
        <li>${f ? estado(f.respondidoEm, `Briefing respondido ${quando(f.respondidoEm || '')}`, f.parciais ? 'Briefing começado' : 'Briefing sem resposta') : estado(false, '', 'Sem briefing')}
          <span>${f ? `<button class="mini" type="button" data-copiar-link="${esc(f.link)}">Copiar link</button><a class="mini" href="/admin/formularios/" target="_blank" rel="noopener">Respostas</a>` : '<a class="mini" href="/admin/formularios/" target="_blank" rel="noopener">Criar</a>'}</span></li>
        <li>${k === undefined ? '<span class="fc-estado">Contrato…</span>' : estado(temContrato, 'Contrato gerado', 'Sem contrato')}
          <span>${temContrato ? `<a class="mini" href="/contratos/${encodeURIComponent(p.id)}" target="_blank" rel="noopener">Abrir</a>` : '<a class="mini" href="/admin/contratos/" target="_blank" rel="noopener">Gerar</a>'}</span></li>
      </ol>
      ${ids.has(p.id) ? `<button class="fc-desligar" type="button" data-desligar="${esc(p.id)}">Desligar esta proposta</button>` : '<p class="fc-dica">Ligada pelo nome. <button class="fc-desligar" type="button" data-ligar="' + esc(p.id) + '">Confirmar ligação</button></p>'}
    </article>`;
  };
  const livres = docs.propostas.filter((p) => !props.includes(p));
  $('#briefing').innerHTML = (props.map(cartao).join('') || '<p class="vazio">Nenhuma proposta ligada a este cliente.</p>') + `
    <article class="crm-card-box fc-ligar">
      <h3>Ligar uma proposta</h3>
      <p class="fc-dica">A proposta traz junto o briefing e o contrato dela.</p>
      <div class="fc-add"><select id="ligar-proposta" aria-label="Proposta para ligar"><option value="">Escolha a proposta</option>${livres.map((p) => `<option value="${esc(p.id)}">${esc(p.cliente || p.id)}: ${esc((p.titulo || '').replace(/\s+/g, ' ').slice(0, 50))}</option>`).join('')}</select>
      <button class="mini mini--ativo" type="button" data-ligar-escolhida>Ligar</button></div>
    </article>`;
  $('#n-docs').textContent = props.length || '';
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

function desenhar() { desenharCabecalho(); desenharResumo(); desenharTarefas(); desenharMateriais(); desenharBriefing(); desenharNotas(); desenharClickup(); }

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
  });

  $('#etapa').addEventListener('change', (e) => salvar({ etapa: e.target.value }).then(() => avisar('Etapa atualizada.')).catch((err) => avisar(err.message, 'erro')));
  for (const raiz of ['#resumo-tarefas', '#tarefas']) ligarLista($(raiz), { achar: () => c, aoSalvar: guardar, clientes: () => todos });
  $('#ver-feitas').addEventListener('change', desenharTarefas);

  // Pasta do Drive com os materiais do cliente.
  $('#drive-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = e.target.elements.drive.value.trim();
    if (v && !/^https?:\/\//i.test(v)) return avisar('O link precisa começar com https://.', 'erro');
    salvar({ drive: v }).then(() => avisar(v ? 'Pasta do Drive salva.' : 'Pasta do Drive tirada.')).catch((err) => avisar(err.message, 'erro'));
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
    // Ligar e desligar propostas: só mexe na lista do cliente, nunca na proposta.
    const atual = new Set(c.propostas || []);
    const ligar = (id) => { atual.add(id); return salvar({ propostas: [...atual] }).then(buscarContratos); };
    if (e.target.closest('[data-ligar]')) ligar(e.target.closest('[data-ligar]').dataset.ligar).catch((err) => avisar(err.message, 'erro'));
    if (e.target.closest('[data-ligar-escolhida]')) {
      const id = $('#ligar-proposta').value;
      if (id) ligar(id).then(() => avisar('Proposta ligada.')).catch((err) => avisar(err.message, 'erro'));
    }
    const d = e.target.closest('[data-desligar]');
    if (d) { atual.delete(d.dataset.desligar); salvar({ propostas: [...atual] }).catch((err) => avisar(err.message, 'erro')); }
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
$('#apagar').onclick = async () => {
  if (!c || !confirm(`Apagar ${c.nome} do CRM? Não dá para desfazer.`)) return;
  const r = await fetch(`/api/crm/${c.id}`, { method: 'DELETE' });
  if (!r.ok) return avisar((await r.json().catch(() => ({}))).erro || 'Não deu para apagar.', 'erro');
  location.replace('/admin/crm/#clientes');
};
$('#form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.elements, dado = {};
  for (const k of CAMPOS) dado[k] = f[k].value;
  try { await salvar(dado); $('#jan').close(); avisar('Dados salvos.'); }
  catch (err) { avisar(err.message, 'erro'); }
});

async function carregar() {
  const [d, ds] = await Promise.all([carregarCrm(), documentos()]);
  todos = d.clientes; etapas = d.etapas; origens = d.origens || []; docs = ds;
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
  buscarContratos();
  buscarClickup();
}

$('#buscar').onclick = ligarBusca(() => todos);
carregar().catch((e) => { $('#ficha').innerHTML = `<p class="vazio">${esc(e.message)}</p>`; });
// O Claude pode ter mexido enquanto a aba estava em segundo plano.
let ultimaCarga = Date.now();   // no máximo uma recarga por minuto
addEventListener('focus', () => {
  if (!c || document.querySelector('dialog[open]') || document.activeElement?.matches('input, textarea') || Date.now() - ultimaCarga < 60000) return;
  ultimaCarga = Date.now();
  carregar().catch(() => {});
});
addEventListener('hashchange', () => { if (decodeURIComponent(location.hash.slice(1)).split('&')[0] !== c?.id) location.reload(); });
