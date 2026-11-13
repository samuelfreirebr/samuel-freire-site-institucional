/* Leads que se atualizam quase sozinhos.

   1. Falar hoje: quem pede follow-up (data chegou ou parado) e o
      "Mandei" que marca o próximo contato.
   2. Atualizar pela conversa: o Samuel solta a conversa exportada do
      WhatsApp, um print, ou dita o que aconteceu. A IA acha o lead e
      propõe etapa, próximo passo, data, nota e Mapa de Preço. Ele
      confere e salva.

   Mora fora do crm.js para a aba Leads crescer sem mexer nas outras. */

import {
  $, esc, avisar, salvarCliente, anotar, NOMES, LEADS, iniciais, visiveis, situacaoLead, leadPedeAtencao,
  somarDias, dataLonga, hojeIso,
} from './comum.js?v=20261112t';

/* ---------- Central de ajustes ---------- */
const DIAS_MANDEI = [2, 4, 7];   // botões "Mandei: falar de novo em X dias"

let obter = { clientes: () => [], etapas: () => [], guardar: () => {} };
const ficha = (c) => `/admin/crm/cliente/#${c.id}`;
const achar = (id) => obter.clientes().find((c) => c.id === id);

async function pedirIa(url, corpo) {
  const r = await fetch(url, { method: 'POST', body: corpo });
  if (r.status === 401) { location.replace('/admin/entrar?voltar=' + encodeURIComponent(location.pathname)); throw new Error('Faça login.'); }
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.erro || 'A IA não respondeu.');
  return d;
}

/* ---------- 1. Falar hoje ---------- */

export function desenharHoje() {
  const peso = { atrasado: 0, hoje: 1, parado: 2 };
  const lista = visiveis(obter.clientes()).filter(leadPedeAtencao)
    .sort((a, b) => peso[situacaoLead(a).chave] - peso[situacaoLead(b).chave] || (a.proximoContato || '').localeCompare(b.proximoContato || ''));
  $('#hoje-total').textContent = lista.length ? `${lista.length} para falar` : '';
  $('#hoje-leads').innerHTML = lista.map((c) => {
    const s = situacaoLead(c);
    return `<li data-id="${c.id}">
      <div class="lh-linha">
        <a class="crm-cli" href="${ficha(c)}" target="_blank" rel="noopener"><span class="crm-avatar" aria-hidden="true">${esc(iniciais(c.nome))}</span>
          <span><b>${esc(c.nome)}</b><small>${esc(c.proximoPasso || c.servico || 'Sem próximo passo')}</small></span></a>
        <span class="crm-situacao alerta">${esc(s.texto)}</span>
        <div class="lh-acoes">
          <span class="lh-mandei">Mandei, falar de novo em ${DIAS_MANDEI.map((d) => `<button class="mini" type="button" data-mandei="${d}">${d} dias</button>`).join('')}</span>
        </div>
      </div>
    </li>`;
  }).join('') || '<li class="vazio">Ninguém para falar hoje. Os próximos follow-ups estão na tabela abaixo.</li>';
}

// Mandei: anota na linha do tempo e marca a próxima data. Lead com proposta enviada passa a "Follow-up".
async function mandei(li, c, dias) {
  try {
    await anotar(c.id, 'Follow-up enviado.', 'nota');
    const salvo = await salvarCliente({ id: c.id, proximoContato: somarDias(dias), ...(c.etapa === 'proposta' ? { etapa: 'followup' } : {}) });
    obter.guardar(salvo);
    avisar(`Anotado. Falar de novo com ${c.nome} em ${dias} dias.`);
  } catch (err) { avisar(err.message, 'erro'); }
}

/* ---------- 2. Atualizar pela conversa ---------- */

let arquivos = [];
let lida = null;   // a atualização que a IA devolveu
const form = () => $('#conversa-form').elements;

function abrirConversa() {
  arquivos = []; lida = null;
  $('#conversa-texto').value = ''; $('#conversa-arquivos').value = ''; $('#conversa-lista').textContent = '';
  $('#conversa-form').hidden = true; $('#conversa-salvar').hidden = true; $('#conversa-res').hidden = true;
  $('#conversa-jan').showModal();
  $('#conversa-texto').focus();
}

const mostrarArquivos = () => { $('#conversa-lista').textContent = arquivos.map((a) => a.name).join(', '); };

async function lerConversa() {
  const texto = $('#conversa-texto').value.trim();
  if (!texto && !arquivos.length) return avisar('Cole a conversa, dite o recado ou escolha um arquivo.', 'erro');
  const b = $('#conversa-ler'), solta = $('#conversa-solta');
  b.disabled = true; b.textContent = 'Lendo…'; solta.classList.add('lendo');
  try {
    const corpo = new FormData();
    corpo.append('texto', texto);
    arquivos.forEach((a) => corpo.append('arquivos', a, a.name));
    lida = (await pedirIa('/api/crm/ia-atualizar', corpo)).atualizacao;
    preencher(lida);
  } catch (err) { avisar(err.message, 'erro'); }
  finally { b.disabled = false; b.textContent = 'Ler com IA'; solta.classList.remove('lendo'); }
}

function preencher(x) {
  const f = form();
  const pessoas = visiveis(obter.clientes()).sort((a, b) => LEADS.includes(b.etapa) - LEADS.includes(a.etapa) || a.nome.localeCompare(b.nome));
  $('#conversa-quem').innerHTML = '<option value="">Lead novo</option>' + pessoas.map((c) => `<option value="${c.id}">${esc(c.nome)}</option>`).join('');
  $('#conversa-etapa').innerHTML = obter.etapas().map((e) => `<option value="${e.id}">${e.id === 'encerrado' ? 'Não fechou (encerrar)' : esc(e.nome)}</option>`).join('');
  f.quem.value = x.id;
  f.nome.value = x.id ? '' : x.nome;
  for (const k of ['etapa', 'proximoPasso', 'proximoContato', 'resumo', 'contato', 'servico', 'mapaPreco', 'motivoPerda']) f[k].value = x[k] || '';
  f.origemLead.innerHTML = '<option value="">Não informada</option>' + Object.entries(NOMES.origem).map(([k, n]) => `<option value="${k}">${n}</option>`).join('');
  f.origemLead.value = x.origemLead || '';
  mostrarCampos();
  const dono = achar(x.id);
  $('#conversa-res').hidden = false;
  $('#conversa-res').innerHTML = dono
    ? `É de <b>${esc(dono.nome)}</b>. Confira o que muda e salve.`
    : `Não achei no CRM: vai entrar como <b>lead novo</b>. Se for alguém que já está lá, escolha o nome.`;
  $('#conversa-form').hidden = false; $('#conversa-salvar').hidden = false;
}

// Lead novo pede nome e origem; encerrar pede o motivo; sem mapa, a caixa some.
function mostrarCampos() {
  const f = form(), novo = !f.quem.value;
  $('#conversa-novo').hidden = !novo;
  $('#conversa-perda').hidden = f.etapa.value !== 'encerrado';
  $('#conversa-mapa').hidden = !f.mapaPreco.value.trim();
  const dono = achar(f.quem.value);
  $('#conversa-contato-dica').textContent = dono?.contato ? `A ficha já tem: ${dono.contato}. O que estiver aqui soma ao que já tem.` : '';
}

async function salvarConversa(e) {
  e.preventDefault();
  const f = form(), dono = achar(f.quem.value);
  if (!dono && !f.nome.value.trim()) return avisar('Dê um nome ao lead novo.', 'erro');
  const mapa = f.mapaPreco.value.trim();
  const dado = { etapa: f.etapa.value, proximoPasso: f.proximoPasso.value.trim(), proximoContato: f.etapa.value === 'encerrado' ? '' : f.proximoContato.value };
  if (f.etapa.value === 'encerrado') dado.motivoPerda = f.motivoPerda.value.trim() || 'Não informado';
  if (f.servico.value.trim()) dado.servico = f.servico.value.trim();
  const contato = f.contato.value.trim();
  if (mapa) dado.notas = `${dono?.notas || ''}\n\nMAPA DE PREÇO (${dataLonga(hojeIso())})\n${mapa}`.trim();
  if (dono) {
    dado.id = dono.id;
    const novos = contato.split('·').map((p) => p.trim()).filter((p) => p && !(dono.contato || '').includes(p));
    if (novos.length) dado.contato = [dono.contato, ...novos].filter(Boolean).join(' · ');
  } else Object.assign(dado, { nome: f.nome.value.trim(), contato, origemLead: f.origemLead.value });
  try {
    let salvo = await salvarCliente(dado);
    if (f.resumo.value.trim()) salvo = await anotar(salvo.id, `Conversa: ${f.resumo.value.trim()}`, 'nota');
    obter.guardar(salvo);
    $('#conversa-jan').close();
    avisar(dado.proximoContato ? `${salvo.nome} atualizado. Falar de novo em ${dataLonga(dado.proximoContato)}.` : `${salvo.nome} atualizado.`);
  } catch (err) { avisar(err.message, 'erro'); }
}

/* ---------- ligar ---------- */

export function ligarLeads(opcoes) {
  obter = opcoes;
  $('#hoje-leads').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-id]');
    const c = li && achar(li.dataset.id);
    if (!c) return;
    if (e.target.closest('[data-mandei]')) mandei(li, c, +e.target.closest('[data-mandei]').dataset.mandei);
  });

  $('#atualizar-conversa').onclick = abrirConversa;
  $('#conversa-ler').onclick = lerConversa;
  $('#conversa-form').addEventListener('submit', salvarConversa);
  $('#conversa-form').addEventListener('change', (e) => { if (['quem', 'etapa'].includes(e.target.name)) mostrarCampos(); });
  $('#conversa-atalhos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-dias]');
    if (b) form().proximoContato.value = somarDias(+b.dataset.dias);
  });
  $('#conversa-arquivos').addEventListener('change', (e) => { arquivos = [...arquivos, ...e.target.files]; mostrarArquivos(); });
  const solta = $('#conversa-solta');
  solta.addEventListener('dragover', (e) => { e.preventDefault(); solta.classList.add('ativa'); });
  solta.addEventListener('dragleave', (e) => { if (!solta.contains(e.relatedTarget)) solta.classList.remove('ativa'); });
  solta.addEventListener('drop', (e) => {
    e.preventDefault(); solta.classList.remove('ativa');
    arquivos = [...arquivos, ...e.dataTransfer.files];
    const txt = e.dataTransfer.getData('text');
    if (txt && !e.dataTransfer.files.length) $('#conversa-texto').value += ($('#conversa-texto').value ? '\n' : '') + txt;
    mostrarArquivos();
  });
  $('#conversa-texto').addEventListener('paste', (e) => {
    const imgs = [...(e.clipboardData?.files || [])];
    if (imgs.length) { e.preventDefault(); arquivos = [...arquivos, ...imgs]; mostrarArquivos(); }
  });
}
