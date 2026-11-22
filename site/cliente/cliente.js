/* ============================================================
   Painel do cliente: entra com e-mail e senha (criados pelo
   Samuel no /admin/metricas) e vê os leads e os números do site.
   Texto em inglês: os clientes atendidos aqui são dos EUA.
   ============================================================ */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('en-US');
let dias = 30;

async function api(rota, opcoes) {
  const r = await fetch('/cliente/api/' + rota, opcoes);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.erro || 'Something went wrong.'); e.status = r.status; throw e; }
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function variacao(agora, antes) {
  if (!antes) return agora ? '<span class="cl-var cl-var--sobe">new</span>' : '';
  const p = Math.round(((agora - antes) / antes) * 100);
  if (!p) return '<span class="cl-var">same</span>';
  return `<span class="cl-var cl-var--${p > 0 ? 'sobe' : 'desce'}">${p > 0 ? '+' : ''}${p}%</span>`;
}

const cartao = (rotulo, agora, antes) =>
  `<div class="cl-num"><p class="cl-num__rotulo">${rotulo}</p><p class="cl-num__valor">${num(agora)}</p>${variacao(agora, antes)}</div>`;

function leadHtml(l) {
  const novo = Date.now() - Date.parse(l.em) < 864e5;
  const tel = digitos(l.telefone);
  const botoes = [
    tel && `<a class="cl-btn cl-btn--cheio" href="tel:+${zap(l.telefone)}">Call</a>`,
    tel && `<a class="cl-btn" href="sms:+${zap(l.telefone)}">Text</a>`,
    tel && `<a class="cl-btn" href="https://wa.me/${zap(l.telefone)}" target="_blank" rel="noopener">WhatsApp</a>`,
    l.email && `<a class="cl-btn" href="mailto:${esc(l.email)}">Email</a>`,
  ].filter(Boolean).join('');
  return `<li class="cl-cartao cl-lead">
    <div class="cl-lead__topo">
      <p class="cl-lead__nome">${esc(l.nome)}${novo ? ' <span class="cl-novo">New</span>' : ''}</p>
      <time class="cl-lead__quando" datetime="${esc(l.em)}">${quando(l.em)}</time>
    </div>
    <dl class="cl-lead__dados">
      ${l.telefone ? `<div><dt>Phone</dt><dd>${esc(telefone(l.telefone))}</dd></div>` : ''}
      ${l.email ? `<div><dt>Email</dt><dd>${esc(l.email)}</dd></div>` : ''}
      ${l.cep ? `<div><dt>Zip code</dt><dd>${esc(l.cep)}</dd></div>` : ''}
      ${l.servicos?.length ? `<div><dt>Service</dt><dd>${l.servicos.map((s) => `<span class="cl-chip">${esc(s)}</span>`).join(' ')}</dd></div>` : ''}
      ${l.mensagem ? `<div class="cl-lead__msg"><dt>Message</dt><dd>${esc(l.mensagem)}</dd></div>` : ''}
    </dl>
    <div class="cl-lead__acoes">${botoes}</div>
  </li>`;
}

const NOMES_ORIGEM = { direto: 'Direct (typed or saved)', google: 'Google', instagram: 'Instagram', facebook: 'Facebook' };

function render(d) {
  const a = d.atual, b = d.anterior;
  $('#nome-site').textContent = d.site.nome;
  $('#email').textContent = d.email;
  document.title = d.site.nome + ' | Website dashboard';
  $('#numeros').innerHTML =
    cartao('Estimate requests', a.leads, b.leads) +
    cartao('Call and text clicks', a.ligar + a.sms + a.whatsapp, b.ligar + b.sms + b.whatsapp) +
    cartao('Visits', a.visitas, b.visitas) +
    cartao('Unique visitors', a.visitantes, b.visitantes);
  // Leads do período escolhido, o mais novo primeiro.
  const desde = Date.now() - dias * 864e5;
  const leads = d.leads.filter((l) => Date.parse(l.em) >= desde);
  $('#total-leads').textContent = leads.length ? `(${leads.length})` : '';
  $('#leads').innerHTML = leads.length
    ? leads.map(leadHtml).join('')
    : `<li class="cl-vazio">No leads in the last ${dias} days yet. New estimate requests from your website show up here.</li>`;
  const total = a.origens.reduce((s, o) => s + o.n, 0);
  $('#origens').innerHTML = total
    ? a.origens.map((o) => `<li><span>${esc(NOMES_ORIGEM[o.nome] || o.nome)}</span><b>${num(o.n)}</b><i style="--p:${Math.round((o.n / total) * 100)}%"></i></li>`).join('')
    : '<li class="cl-vazio">No visits in this period yet.</li>';
}

async function carregar() {
  try {
    render(await api('painel?dias=' + dias));
    mostrar('painel');
    avisos();
  } catch (e) {
    if (e.status === 401) return mostrar('entrar');
    $('#leads').innerHTML = `<li class="cl-vazio">${esc(e.message)}</li>`;
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
  dias = Number(b.dataset.dias);
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
  b.textContent = ligado ? 'Notifications on' : 'Turn on notifications';
  b.setAttribute('aria-pressed', String(ligado));
  b.title = ligado ? 'Tap to turn off notifications on this device' : 'Get a notification on this device for every new lead';
  b.onclick = async () => {
    if (Notification.permission === 'denied') return alert('Notifications are blocked for this site. Allow them in your browser or phone settings, then try again.');
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
    } catch (e) { alert('Could not change notifications: ' + e.message); }
    finally { b.disabled = false; avisos(); }
  };
}

// Volta para a aba: busca de novo, para o lead novo aparecer sem recarregar.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#painel').hidden) carregar(); });

carregar();
