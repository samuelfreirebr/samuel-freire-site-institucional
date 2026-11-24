/* ============================================================
   Painel do cliente: entra com e-mail e senha (criados pelo
   Samuel no /admin/metricas) e vê os leads e os números do site.
   Tudo em português (pedido do Matheus, 24/11/2026).
   Com ?site=<id>, o Samuel logado vê o painel daquele cliente.
   ============================================================ */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Number(n || 0).toLocaleString('pt-BR');
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

/* Comparação com o período anterior do mesmo tamanho. No Máximo não
   há período anterior, e sem número antes não há o que comparar. */
function variacao(agora, antes) {
  if (dias === 'max' || !antes) return '';
  const p = Math.round(((agora - antes) / antes) * 100);
  const vs = ` vs. ${dias} dias antes`;
  if (!p) return `<span class="cl-var"><b>igual</b>${vs}</span>`;
  return `<span class="cl-var cl-var--${p > 0 ? 'sobe' : 'desce'}"><b>${p > 0 ? '+' : ''}${p}%</b>${vs}</span>`;
}

const cartao = (rotulo, agora, antes) =>
  `<div class="cl-num"><p class="cl-num__rotulo">${rotulo}</p><p class="cl-num__valor">${num(agora)}</p>${variacao(agora, antes)}</div>`;

function leadHtml(l) {
  const novo = Date.now() - Date.parse(l.em) < 864e5;
  const tel = digitos(l.telefone);
  const botoes = [
    tel && `<a class="cl-btn cl-btn--cheio" href="tel:+${zap(l.telefone)}">Ligar</a>`,
    tel && `<a class="cl-btn" href="sms:+${zap(l.telefone)}">SMS</a>`,
    tel && `<a class="cl-btn" href="https://wa.me/${zap(l.telefone)}" target="_blank" rel="noopener">WhatsApp</a>`,
    l.email && `<a class="cl-btn" href="mailto:${esc(l.email)}">E-mail</a>`,
  ].filter(Boolean).join('');
  return `<li class="cl-lead">
    <div class="cl-lead__topo">
      <p class="cl-lead__nome">${esc(l.nome)}${novo ? ' <span class="cl-novo">Novo</span>' : ''}</p>
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

const NOMES_ORIGEM = { direto: 'Direto (digitou ou salvou)', google: 'Google', instagram: 'Instagram', facebook: 'Facebook' };

function render(d) {
  const a = d.atual, b = d.anterior;
  $('#nome-site').textContent = d.site.nome;
  $('#email').textContent = d.email ? ' · ' + d.email : '';
  document.title = d.site.nome + ' | Painel do site';
  $('#numeros').innerHTML =
    cartao('Pedidos de orçamento', a.leads, b.leads) +
    cartao('Cliques em ligar e mensagem', a.ligar + a.sms + a.whatsapp, b.ligar + b.sms + b.whatsapp) +
    cartao('Visitas', a.visitas, b.visitas) +
    cartao('Pessoas diferentes', a.visitantes, b.visitantes);
  // Leads do período escolhido, o mais novo primeiro.
  const desde = dias === 'max' ? 0 : Date.now() - dias * 864e5;
  const leads = d.leads.filter((l) => Date.parse(l.em) >= desde);
  $('#total-leads').textContent = leads.length ? `(${leads.length})` : '';
  $('#leads').innerHTML = leads.length
    ? leads.map(leadHtml).join('')
    : `<li class="cl-vazio">${dias === 'max' ? 'Nenhum pedido ainda.' : `Nenhum pedido nos últimos ${dias} dias.`} Os pedidos de orçamento do seu site aparecem aqui.</li>`;
  const total = a.origens.reduce((s, o) => s + o.n, 0);
  $('#origens').innerHTML = total
    ? a.origens.map((o) => `<li><span>${esc(NOMES_ORIGEM[o.nome] || o.nome)}</span><b>${num(o.n)}</b><i style="--p:${Math.round((o.n / total) * 100)}%"></i></li>`).join('')
    : '<li class="cl-vazio">Ainda sem visitas neste período.</li>';
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
  b.textContent = ligado ? 'Avisos ligados' : 'Ligar avisos';
  b.setAttribute('aria-pressed', String(ligado));
  b.title = ligado ? 'Toque para desligar os avisos neste aparelho' : 'Receba um aviso neste aparelho a cada pedido novo';
  b.onclick = async () => {
    if (Notification.permission === 'denied') return alert('Os avisos estão bloqueados para este site. Libere nos ajustes do navegador ou do celular e tente de novo.');
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
    } catch (e) { alert('Não deu para mudar os avisos: ' + e.message); }
    finally { b.disabled = false; avisos(); }
  };
}

// Volta para a aba: busca de novo, para o lead novo aparecer sem recarregar.
document.addEventListener('visibilitychange', () => { if (!document.hidden && !$('#painel').hidden) carregar(); });

carregar();
