/* ============================================================
   Painel do cliente: entra com e-mail e senha (criados pelo
   Samuel no /admin/metricas) e vê os leads e os números do site.
   Tudo em português (pedido do Matheus, 24/11/2026).
   Com ?site=<id>, o Samuel logado vê o painel daquele cliente.
   ============================================================ */

import { relatorio } from './relatorio.js?v=20261124b';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* Ícones de traço fino, 16px, na cor do texto (mesmo desenho do painel do Samuel). */
const DESENHOS = {"ligar": "M5.5 2.5 3 3c-.3 4.9 5.1 10.3 10 10l.5-2.5-2.8-1.2-1.3 1.3a7 7 0 0 1-3-3l1.3-1.3z", "sms": "M2.5 3.5h11v7.5H7l-3 2.5V11H2.5z", "whatsapp": "M3 13l.8-2.6A5.5 5.5 0 1 1 5.7 12.3z M6.2 5.5c0 2.2 2 4.3 4.3 4.3l.6-1.1-1.3-.6-.6.6c-.9-.4-1.5-1-1.9-1.9l.6-.6-.6-1.3z", "email": "M2 3.5h12v9H2z M2.5 4l5.5 4.5L13.5 4", "pedidos": "M2 9.5 4 3h8l2 6.5V13H2z M2 9.5h3.5l1 1.5h3l1-1.5H14"};
const ico = (n) => `<svg class="cl-ico" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${DESENHOS[n]}"/></svg>`;
let dias = 30;              // ou 'max': todo o histórico
const verSite = new URLSearchParams(location.search).get('site');

async function api(rota, opcoes) {
  const r = await fetch('/cliente/api/' + rota, opcoes);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.erro || 'Algo deu errado.'); e.status = r.status; throw e; }
  return j;
}

function mostrar(qual) {
  $('#entrar').hidden = qual !== 'entrar';
  $('#painel').hidden = qual !== 'painel';
}

/* Telefone dos EUA com 10 dígitos ganha o 1 na frente para o WhatsApp. */
const digitos = (t) => String(t || '').replace(/\D/g, '');
const zap = (t) => { const d = digitos(t); return d.length === 10 ? '1' + d : d; };
const telefone = (t) => { const d = digitos(t).replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : t; };

function quando(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function leadHtml(l) {
  const novo = Date.now() - Date.parse(l.em) < 864e5;
  const tel = digitos(l.telefone);
  const botoes = [
    tel && `<a class="cl-btn cl-btn--cheio" href="tel:+${zap(l.telefone)}">${ico('ligar')}Ligar</a>`,
    tel && `<a class="cl-btn" href="sms:+${zap(l.telefone)}">${ico('sms')}SMS</a>`,
    tel && `<a class="cl-btn" href="https://wa.me/${zap(l.telefone)}" target="_blank" rel="noopener">${ico('whatsapp')}WhatsApp</a>`,
    l.email && `<a class="cl-btn" href="mailto:${esc(l.email)}">${ico('email')}E-mail</a>`,
  ].filter(Boolean).join('');
  return `<li class="cl-lead">
    <div class="cl-lead__topo">
      <p class="cl-lead__nome">${verSite ? `<input type="checkbox" class="cl-marcar" value="${esc(l.id)}" aria-label="Selecionar ${esc(l.nome)}">` : ''}${esc(l.nome)}${novo ? ' <span class="cl-novo">Novo</span>' : ''}</p>
      <time class="cl-lead__quando" datetime="${esc(l.em)}">${quando(l.em)}</time>
    </div>
    <dl class="cl-lead__dados">
      ${l.telefone ? `<div><dt>Telefone</dt><dd>${esc(telefone(l.telefone))}</dd></div>` : ''}
      ${l.email ? `<div><dt>E-mail</dt><dd>${esc(l.email)}</dd></div>` : ''}
      ${l.cep ? `<div><dt>CEP</dt><dd>${esc(l.cep)}</dd></div>` : ''}
      ${l.servicos?.length ? `<div><dt>Serviço</dt><dd>${l.servicos.map((s) => `<span class="cl-chip">${esc(s)}</span>`).join(' ')}</dd></div>` : ''}
      ${l.mensagem ? `<div class="cl-lead__msg"><dt>Mensagem</dt><dd>${esc(l.mensagem)}</dd></div>` : ''}
    </dl>
    <div class="cl-lead__acoes">${botoes}</div>
  </li>`;
}

/* Mesmo relatório do painel do Samuel (relatorio.js), com os pedidos
   logo depois dos números: é o que o cliente mais quer ver. */
function render(d) {
  $('#nome-site').textContent = d.site.nome;
  $('#email').textContent = d.email ? ' · ' + d.email : '';
  document.title = d.site.nome + ' | Painel do site';
  // Pedidos do período escolhido, o mais novo primeiro.
  const desde = dias === 'max' ? 0 : Date.now() - dias * 864e5;
  const leads = d.leads.filter((l) => Date.parse(l.em) >= desde);
  const pedidos = `<section class="cl-bloco">
    <div class="cl-bloco__cab"><h2 class="cl-h2">${ico('pedidos')}Pedidos ${leads.length ? `<span>(${leads.length})</span>` : ''}</h2>${verSite && leads.length ? '<button type="button" class="cl-btn cl-btn--leve" id="apagar-leads" hidden>Apagar</button>' : ''}</div>
    <ul class="cl-leads">${leads.length
      ? leads.map(leadHtml).join('')
      : `<li class="cl-vazio">${dias === 'max' ? 'Nenhum pedido ainda.' : `Nenhum pedido nos últimos ${dias} dias.`} Os pedidos de orçamento do seu site aparecem aqui.</li>`}</ul>
  </section>`;
  $('#relatorio').innerHTML = relatorio(d, { lingua: 'pt', comparar: dias !== 'max', depois: pedidos });
}

async function carregar() {
  try {
    render(await api('painel?dias=' + dias + (verSite ? '&site=' + encodeURIComponent(verSite) : '')));
    mostrar('painel');
    if (verSite) { $('#aviso-samuel').hidden = false; $('#sair').hidden = true; return; }
    avisos();
  } catch (e) {
    if (e.status === 401 && verSite) return location.assign('/admin/entrar?voltar=' + encodeURIComponent(location.pathname + location.search));
    if (e.status === 401) return mostrar('entrar');
    $('#relatorio').innerHTML = `<p class="cl-vazio">${esc(e.message)}</p>`;
  }
}

$('#form-entrar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, botao = f.querySelector('button');
  botao.disabled = true; $('#erro-entrar').textContent = '';
  try {
    await api('entrar', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email.value, senha: f.senha.value }) });
    f.reset();
    await carregar();
  } catch (err) { $('#erro-entrar').textContent = err.message; }
  finally { botao.disabled = false; }
});

$('#sair').addEventListener('click', async () => { await api('sair', { method: 'POST' }).catch(() => {}); mostrar('entrar'); });

$('#periodo').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $('#periodo').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  dias = b.dataset.dias === 'max' ? 'max' : Number(b.dataset.dias);
  carregar();
});

/* Notificações de lead novo neste aparelho (Web Push). No iPhone só
   funciona com o painel aberto pelo ícone da tela de início (iOS 16.4+). */
async function avisos() {
  const b = $('#avisos');
  const suporta = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const iphone = /iPhone|iPad/.test(navigator.userAgent);
  const instalado = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  $('#dica-iphone').hidden = !(iphone && !instalado);
  if (!suporta) { b.hidden = true; return; }
  const reg = await navigator.serviceWorker.register('/cliente/sw.js', { scope: '/cliente/' }).then(() => navigator.serviceWorker.ready).catch(() => null);
  if (!reg) { b.hidden = true; return; }
  const sub = await reg.pushManager.getSubscription();
  const ligado = !!sub && Notification.permission === 'granted';
  b.hidden = false;
  // Chave liga e desliga: o sino e o texto ficam, só a chave muda.
  b.setAttribute('aria-checked', String(ligado));
  b.title = ligado ? 'Notificações ligadas: toque para desligar neste aparelho' : 'Receba uma notificação neste aparelho a cada pedido novo';
  b.onclick = async () => {
    if (Notification.permission === 'denied') return alert('As notificações estão bloqueadas para este site. Libere nos ajustes do navegador ou do celular e tente de novo.');
    b.disabled = true;
    try {
      if (ligado) {
        await api('push/sair', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      } else {
        if (await Notification.requestPermission() !== 'granted') return;
        const { chave } = await api('push/chave');
        const bytes = Uint8Array.from(atob(chave.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
        const nova = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
        await api('push/inscrever', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(nova.toJSON()) });
      }
    } catch (e) { alert('Não deu para mudar as notificações: ' + e.message); }
    finally { b.disabled = false; avisos(); }
  };
}

/* Só o Samuel (?site=): marca os pedidos de teste e apaga. Some do
   painel do cliente e sai da contagem de pedidos. */
$('#relatorio').addEventListener('change', (e) => {
  if (!e.target.matches('.cl-marcar')) return;
  const n = document.querySelectorAll('.cl-marcar:checked').length, b = $('#apagar-leads');
  b.hidden = !n;
  b.textContent = n > 1 ? `Apagar ${n} pedidos` : 'Apagar pedido';
});
$('#relatorio').addEventListener('click', async (e) => {
  const b = e.target.closest('#apagar-leads'); if (!b) return;
  const ids = [...document.querySelectorAll('.cl-marcar:checked')].map((x) => x.value);
  if (!ids.length || !confirm(`Apagar ${ids.length > 1 ? ids.length + ' pedidos' : 'este pedido'} de vez? O cliente não vai mais ver.`)) return;
  b.disabled = true;
  try {
    const r = await fetch('/api/metricas/' + encodeURIComponent(verSite) + '/leads', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids }) });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).erro || 'Algo deu errado.');
    await carregar();
  } catch (err) { alert('Não deu para apagar: ' + err.message); b.disabled = false; }
});

// Volta para a aba: busca de novo, para o lead novo aparecer sem recarregar.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#painel').hidden) carregar(); });

carregar();
