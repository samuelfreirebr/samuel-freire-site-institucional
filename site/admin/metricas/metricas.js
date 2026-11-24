/* ============================================================
   Métricas: relatório de cada site de cliente (dados de /m).
   Sincronizar busca de novo; Exportar PDF imprime só o relatório.
   O relatório sai em português ou inglês (cliente dos EUA).
   ============================================================ */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

import { usarLingua, t, num, dataCurta, cartao, variacao, relatorio } from '/cliente/relatorio.js?v=20261124b';

let sites = [], dias = 15, lingua = 'pt', atual = null, geral = null, teste = '', acesso = null;
const LINK_CLIENTE = 'https://samuelfreire.com.br/cliente/';

function aviso(msg, tipo = 'ok') { const a = $('#aviso'); a.textContent = msg; a.dataset.tipo = tipo; a.classList.add('mostra'); setTimeout(() => a.classList.remove('mostra'), 3500); }

async function api(caminho, opcoes) {
  const r = await fetch('/api/' + caminho, opcoes);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = '/admin/entrar?voltar=/admin/metricas/'; throw new Error(); }
  if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
  return j;
}


/* Barrinhas de visitas por dia, para a linha de cada site. */
function mini(serie) {
  const max = Math.max(1, ...serie.map((d) => d.visitas)), w = 120 / serie.length;
  return `<svg class="mt-mini" viewBox="0 0 120 32" aria-hidden="true">${serie.map((d, i) =>
    `<rect x="${i * w + w * .15}" y="${32 - (d.visitas / max) * 30}" width="${w * .7}" height="${(d.visitas / max) * 30}" class="${d.contatos ? 'mt-graf__c' : 'mt-graf__v'}"/>`).join('')}</svg>`;
}

/* Visão geral: todos os sites lado a lado, quem gerou mais contato primeiro. */
function renderGeral() {
  const el = $('#relatorio');
  if (!sites.length) { el.innerHTML = `<p class="mt-vazio">Nenhum site cadastrado. Clique em <b>Sites</b> para cadastrar o primeiro.</p>`; return; }
  const lista = [...(geral || [])].sort((a, b) => b.atual.contatos - a.atual.contatos || b.atual.visitas - a.atual.visitas);
  const soma = (k, p = 'atual') => lista.reduce((n, x) => n + (x[p][k] || 0), 0);
  el.innerHTML = `
    <header class="mt-cab">
      <div>
        <p class="mt-eyebrow">Visão geral</p>
        <h2 class="mt-titulo">Métricas dos clientes</h2>
        <p class="mt-sub">${lista.length} site${lista.length === 1 ? '' : 's'} medido${lista.length === 1 ? '' : 's'} · últimos ${dias} dias</p>
      </div>
      <p class="mt-sub mt-sub--dir">vs. período anterior</p>
    </header>
    <section class="mt-cards">
      ${cartao('Sites medidos', num(lista.length))}
      ${cartao('Visitas', num(soma('visitas')), soma('visitas'), soma('visitas', 'anterior'))}
      ${cartao('Contatos gerados', num(soma('contatos')), soma('contatos'), soma('contatos', 'anterior'), true)}
      ${cartao('Pedidos de orçamento', num(soma('leads')), soma('leads'), soma('leads', 'anterior'))}
    </section>
    <section class="mt-bloco">
      <h3>Sites dos clientes</h3>
      <div class="mt-tabela">
        <div class="mt-linha mt-linha--cab"><span>Site</span><span>Visitas</span><span>Contatos</span><span>Orçamentos</span><span>Últimos ${dias} dias</span></div>
        ${lista.map((x) => `<button type="button" class="mt-linha" data-abrir="${esc(x.site.id)}">
          <span><b>${esc(x.site.nome)}</b><small>${esc(x.site.dominios[0])}</small></span>
          <span>${num(x.atual.visitas)} ${variacao(x.atual.visitas, x.anterior.visitas)}</span>
          <span class="mt-linha__c">${num(x.atual.contatos)} ${variacao(x.atual.contatos, x.anterior.contatos)}</span>
          <span>${num(x.atual.leads)}</span>
          <span>${mini(x.atual.dias)}</span>
        </button>`).join('')}
      </div>
      <p class="mt-legenda">Contatos = cliques em ligar, WhatsApp, e-mail, SMS e pedidos de orçamento. Clique num site para ver o relatório completo.</p>
    </section>`;
}

function render() {
  const r = atual, el = $('#relatorio');
  if (!r) return renderGeral();
  usarLingua(lingua);
  const a = r.atual;
  const ini = a.dias[0].dia, fim = a.dias.at(-1).dia;
  el.innerHTML = `
    <header class="mt-cab">
      <div>
        <p class="mt-eyebrow">${esc(t('eyebrow'))}</p>
        <h2 class="mt-titulo">${esc(r.site.nome)}</h2>
        <p class="mt-sub">${esc(r.site.dominios[0])}${testeAtual(r.site) ? ' · ' + esc(testeAtual(r.site).nome) : ''} · ${esc(t('periodo'))}: ${dataCurta(ini)} ${esc(t('ate'))} ${dataCurta(fim)}</p>
      </div>
      <p class="mt-sub mt-sub--dir">${esc(t('comp'))}</p>
    </header>
    ${barraTestes(r.site)}
    ${relatorio(r, { lingua })}
    <footer class="mt-pe"><span>${esc(t('rodape'))} · samuelfreire.com.br</span><span>${esc(t('gerado'))} ${new Date(r.geradoEm).toLocaleString(lingua === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</span></footer>`;
}

const dataBr = (iso) => iso.split('-').reverse().slice(0, 2).join('/');
const testeAtual = (site) => (site.testes || []).find((x) => x.id === teste);

/* Faixa de trabalho (fora do PDF): link do cliente à vista, ver o
   painel como ele vê, login e senha e os testes do site. */
function barraTestes(site) {
  const lista = [...(site.testes || [])].reverse();
  const chips = lista.length ? `<div class="mt-testes__lista">
      <button type="button" class="mt-teste__nome${teste ? '' : ' on'}" data-teste="">Últimos ${dias} dias</button>
      ${lista.map((x) => `<span class="mt-teste${x.id === teste ? ' on' : ''}${x.fim ? ' desligado' : ''}">
        <button type="button" class="mt-teste__nome" data-teste="${esc(x.id)}">${esc(x.nome)} <small>desde ${dataBr(x.inicio)}${x.fim ? ' até ' + dataBr(x.fim) : ''}</small></button>
        <label class="mt-chave" title="${x.fim ? 'Desligado: clique para voltar a contar' : 'Ativo: clique para desligar'}"><input type="checkbox" data-ativo="${esc(x.id)}" ${x.fim ? '' : 'checked'}><span></span></label>
      </span>`).join('')}
    </div>` : '';
  const login = acesso ? (acesso.ativo ? esc(acesso.email) : esc(acesso.email) + ' (desligado)') : 'sem login ainda';
  return `<div class="mt-testes">
    <div class="mt-cliente">
      <span class="mt-cliente__rot">Painel do cliente</span>
      <span class="mt-cliente__link">samuelfreire.com.br/cliente <small>· login: ${login}</small></span>
    </div>
    <div class="mt-testes__acoes">
      <button type="button" class="mini mini--ativo" data-acao="copiar-link">Copiar link</button>
      <a class="mini" href="/cliente/?site=${encodeURIComponent(site.id)}" target="_blank" rel="noopener">Ver painel do cliente</a>
      <button type="button" class="mini" data-acao="acesso-cliente">${acesso ? 'Login e senha' : 'Criar login'}</button>
      <button type="button" class="mini" data-acao="novo-teste">+ Teste</button>
    </div>
    ${chips}
  </div>`;
}

async function carregar() {
  const id = $('#site').value;
  $('#sincronizar').disabled = true;
  try {
    const st = id && sites.find((x) => x.id === id), tt = st && testeAtual(st);
    if (!tt) teste = '';
    if (id) [atual, { acesso }] = await Promise.all([api(`metricas/${encodeURIComponent(id)}?` + (tt ? `inicio=${tt.inicio}&fim=${tt.fim}` : `dias=${dias}`)), api(`metricas/${encodeURIComponent(id)}/acesso`)]);
    else { atual = null; geral = (await api(`metricas?dias=${dias}`)).geral; }
    render();
  }
  catch (e) { if (e.message) aviso(e.message, 'erro'); }
  finally { $('#sincronizar').disabled = false; }
}

function montarSites(escolher) {
  $('#site').innerHTML = '<option value="">Todos os sites</option>' + sites.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('');
  if (escolher) $('#site').value = escolher;
  /* Um cartão por site (só um aberto por vez): acesso do cliente,
     código do site e apagar, tudo daquele cliente. */
  $('#lista-sites').innerHTML = sites.length
    ? sites.map((s) => `<li><details class="mt-site" name="sites" data-site="${esc(s.id)}">
      <summary><b>${esc(s.nome)}</b><small>${esc(s.dominios.join(', '))}</small></summary>
      <div class="mt-site__corpo">
        <form class="mt-form" data-form-acesso="${esc(s.id)}">
          <p class="mt-form__titulo">Acesso do cliente</p>
          <p class="mt-sub">O cliente entra em <a href="https://samuelfreire.com.br/cliente/" target="_blank" rel="noopener">samuelfreire.com.br/cliente</a> e vê os leads e os números só deste site.</p>
          <label>E-mail do cliente <input name="email" type="email" required maxlength="160" autocomplete="off" placeholder="cliente@empresa.com"></label>
          <label>Senha <input name="senha" type="text" minlength="6" maxlength="200" autocomplete="off" placeholder="Pelo menos 6 caracteres"></label>
          <p class="mt-sub" data-estado></p>
          <label class="mt-check"><input name="ativo" type="checkbox" checked> Acesso ligado (desligado, o cliente não entra mais)</label>
          <button class="mini mini--ativo" type="submit">Salvar acesso</button>
        </form>
        <div class="mt-form">
          <p class="mt-form__titulo">Código do site</p>
          <p class="mt-sub">Cole no &lt;head&gt; de todas as páginas do site.</p>
          <pre class="mt-codigo">${esc(`<script src="${location.origin}/m.js" data-site="${s.id}" defer></script>`)}</pre>
          <button class="mini" type="button" data-copiar>Copiar código</button>
        </div>
        <button type="button" class="mini mini--perigo" data-apagar="${esc(s.id)}">Apagar site</button>
      </div>
    </details></li>`).join('')
    : '<li class="mt-sub">Nenhum site ainda.</li>';
}

/* Acesso do cliente ao /cliente: e-mail e senha criados aqui. A senha
   fica guardada só como hash, então não volta para a tela. */
async function mostrarAcesso(id) {
  const f = document.querySelector(`[data-form-acesso="${CSS.escape(id)}"]`); if (!f) return;
  f.reset();
  try {
    const { acesso } = await api(`metricas/${encodeURIComponent(id)}/acesso`);
    f.email.value = acesso?.email || '';
    f.ativo.checked = acesso ? acesso.ativo : true;
    f.senha.placeholder = acesso ? 'Deixe vazio para manter a senha atual' : 'Pelo menos 6 caracteres';
    f.senha.required = !acesso;
    f.querySelector('[data-estado]').textContent = acesso?.senhaEm ? 'Senha criada em ' + new Date(acesso.senhaEm).toLocaleDateString('pt-BR') + '. Ela não aparece aqui: se o cliente esquecer, crie outra.' : 'Ainda sem acesso. Crie o e-mail e a senha.';
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
}

/* Abre a janela já no cartão daquele site. */
function abrirSite(id) {
  $('#jan').showModal();
  const d = document.querySelector(`.mt-site[data-site="${CSS.escape(id)}"]`); if (!d) return;
  d.open = true; d.scrollIntoView({ block: 'start' });
}

async function iniciar() {
  try { sites = (await api('metricas')).sites.sort((a, b) => a.nome.localeCompare(b.nome)); } catch { return; }
  const pedido = new URLSearchParams(location.search).get('site');
  montarSites(sites.some((s) => s.id === pedido) ? pedido : undefined);
  carregar();
}

$('#site').addEventListener('change', () => { teste = ''; carregar(); });

const atualizarSite = (site) => { sites = sites.map((x) => (x.id === site.id ? site : x)); };
async function apagarSite(s) {
  if (!confirm(`Apagar "${s.nome}" das métricas? Ele some da lista e para de contar. Os números ficam guardados no servidor.`)) return;
  try {
    await api('metricas/' + encodeURIComponent(s.id), { method: 'DELETE' });
    sites = sites.filter((x) => x.id !== s.id);
    if ($('#site').value === s.id) { $('#site').value = ''; teste = ''; }
    montarSites($('#site').value || undefined); carregar();
    aviso('Site apagado.');
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
}

$('#relatorio').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-abrir]'); if (b) { $('#site').value = b.dataset.abrir; teste = ''; return carregar(); }
  const tb = e.target.closest('[data-teste]'); if (tb) { teste = tb.dataset.teste; return carregar(); }
  const ac = e.target.closest('[data-acao]'); if (!ac) return;
  const site = sites.find((x) => x.id === $('#site').value); if (!site) return;
  if (ac.dataset.acao === 'copiar-link') {
    await navigator.clipboard.writeText(LINK_CLIENTE + (acesso ? '\nLogin: ' + acesso.email : ''));
    return aviso(acesso ? 'Link e login copiados. A senha você manda à parte.' : 'Link copiado. Crie o login do cliente.');
  }
  if (ac.dataset.acao === 'acesso-cliente') return abrirSite(site.id);
  const nome = prompt('Nome do novo teste (ele conta a partir de hoje):', `Teste ${(site.testes || []).length + 1}`);
  if (nome === null) return;
  try {
    const r = await api(`metricas/${encodeURIComponent(site.id)}/testes`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome }) });
    atualizarSite(r.site); teste = r.site.testes.at(-1).id; carregar();
    aviso('Novo teste iniciado. Ele conta a partir de hoje.');
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
});
$('#relatorio').addEventListener('change', async (e) => {
  const c = e.target.closest('[data-ativo]'); if (!c) return;
  const id = $('#site').value;
  try {
    const r = await api(`metricas/${encodeURIComponent(id)}/testes/${c.dataset.ativo}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ativo: c.checked }) });
    atualizarSite(r.site); carregar();
    aviso(c.checked ? 'Teste ligado de novo.' : 'Teste desligado: os números dele ficam guardados.');
  } catch (err) { c.checked = !c.checked; if (err.message) aviso(err.message, 'erro'); }
});
$('#sincronizar').addEventListener('click', async () => { await carregar(); aviso('Dados atualizados.'); });
$('#pdf').addEventListener('click', () => window.print());
for (const [grupo, chave, fn] of [['#periodo', 'dias', (v) => { dias = Number(v); teste = ''; carregar(); }], ['#idioma', 'lingua', (v) => { lingua = v; render(); }]]) {
  $(grupo).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $(grupo).querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    fn(b.dataset[chave]);
  });
}
$('#abrir-sites').addEventListener('click', () => $('#jan').showModal());
$('#jan-fechar').addEventListener('click', () => $('#jan').close());
/* toggle não sobe pela árvore: escuta na captura. */
$('#lista-sites').addEventListener('toggle', (e) => { if (e.target.open) mostrarAcesso(e.target.dataset.site); }, true);
$('#lista-sites').addEventListener('click', async (e) => {
  const cp = e.target.closest('[data-copiar]');
  if (cp) { await navigator.clipboard.writeText(cp.previousElementSibling.textContent); return aviso('Código copiado.'); }
  const ap = e.target.closest('[data-apagar]'); if (ap) apagarSite(sites.find((x) => x.id === ap.dataset.apagar));
});
$('#lista-sites').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target, id = f.dataset.formAcesso, senha = f.senha.value;
  try {
    await api(`metricas/${encodeURIComponent(id)}/acesso`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email.value, senha, ativo: f.ativo.checked }) });
    await mostrarAcesso(id);
    if (id === $('#site').value) carregar();
    aviso(senha ? 'Acesso salvo. Mande o link, o e-mail e a senha para o cliente.' : 'Acesso salvo.');
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
});
$('#form-site').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const { site } = await api('metricas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: f.nome.value, id: f.elements.namedItem('id').value, dominios: f.dominios.value }) });
    sites = [...sites.filter((s) => s.id !== site.id), site].sort((a, b) => a.nome.localeCompare(b.nome));
    montarSites(site.id); f.reset(); abrirSite(site.id); carregar();
    aviso('Site salvo.');
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
});

iniciar();
