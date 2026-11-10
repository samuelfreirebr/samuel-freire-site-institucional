/* ============================================================
   Métricas: relatório de cada site de cliente (dados de /m).
   Sincronizar busca de novo; Exportar PDF imprime só o relatório.
   O relatório sai em português ou inglês (cliente dos EUA).
   ============================================================ */

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const TXT = {
  pt: {
    eyebrow: 'Relatório do site', periodo: 'Período', ate: 'a', comp: 'vs. período anterior',
    visitas: 'Visitas', visitantes: 'Pessoas diferentes', contatos: 'Contatos gerados', leads: 'Pedidos de orçamento',
    ligar: 'Cliques em ligar', tempo: 'Tempo médio no site',
    dia: 'Visitas e contatos por dia', funil: 'Do visitante ao orçamento', comecaram: 'Começaram o formulário', enviaram: 'Enviaram o pedido',
    acoes: 'O que as pessoas clicaram', whatsapp: 'WhatsApp', email: 'E-mail', mapa: 'Mapa / rotas', social: 'Redes sociais', sms: 'SMS',
    origens: 'De onde vieram', paginas: 'Páginas mais vistas', aparelho: 'Aparelho', celular: 'Celular', computador: 'Computador',
    direto: 'Direto (digitou ou salvou)', vazio: 'Ainda não há dados neste período. Assim que alguém abrir o site, os números aparecem aqui.',
    rodape: 'Preparado por Samuel Freire', gerado: 'Gerado em', novo: 'novo',
  },
  en: {
    eyebrow: 'Website report', periodo: 'Period', ate: 'to', comp: 'vs. previous period',
    visitas: 'Visits', visitantes: 'Unique visitors', contatos: 'Contacts generated', leads: 'Estimate requests',
    ligar: 'Call clicks', tempo: 'Average time on site',
    dia: 'Visits and contacts per day', funil: 'From visitor to estimate', comecaram: 'Started the form', enviaram: 'Sent the request',
    acoes: 'What people clicked', whatsapp: 'WhatsApp', email: 'Email', mapa: 'Map / directions', social: 'Social media', sms: 'Text',
    origens: 'Where they came from', paginas: 'Most viewed pages', aparelho: 'Device', celular: 'Mobile', computador: 'Desktop',
    direto: 'Direct (typed or saved)', vazio: 'No data for this period yet. As soon as someone opens the site, the numbers show up here.',
    rodape: 'Prepared by Samuel Freire', gerado: 'Generated on', novo: 'new',
  },
};

let sites = [], dias = 15, lingua = 'pt', atual = null, geral = null;
const t = (k) => TXT[lingua][k] ?? k;
const num = (n) => Number(n || 0).toLocaleString(lingua === 'en' ? 'en-US' : 'pt-BR');
const dataCurta = (iso) => new Date(iso + 'T12:00').toLocaleDateString(lingua === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short' });
const tempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

function aviso(msg, tipo = 'ok') { const a = $('#aviso'); a.textContent = msg; a.dataset.tipo = tipo; a.classList.add('mostra'); setTimeout(() => a.classList.remove('mostra'), 3500); }

async function api(caminho, opcoes) {
  const r = await fetch('/api/' + caminho, opcoes);
  const j = await r.json().catch(() => ({}));
  if (r.status === 401) { location.href = '/admin/entrar?voltar=/admin/metricas/'; throw new Error(); }
  if (!r.ok) throw new Error(j.erro || 'Algo deu errado.');
  return j;
}

/* Variação contra o período anterior. */
function variacao(agora, antes) {
  if (!antes && !agora) return '';
  if (!antes) return `<span class="mt-var mt-var--sobe">${t('novo')}</span>`;
  const p = Math.round(((agora - antes) / antes) * 100);
  if (!p) return '<span class="mt-var">0%</span>';
  return `<span class="mt-var ${p > 0 ? 'mt-var--sobe' : 'mt-var--desce'}">${p > 0 ? '↑' : '↓'} ${Math.abs(p)}%</span>`;
}

function cartao(rotulo, valor, agora, antes, destaque) {
  return `<div class="mt-card${destaque ? ' mt-card--destaque' : ''}"><p class="mt-card__rot">${esc(rotulo)}</p><p class="mt-card__num">${valor}</p>${variacao(agora, antes)}</div>`;
}

/* Barras por dia: visitas (cinza) e contatos (laranja). SVG puro. */
function grafico(serie) {
  const L = 900, A = 220, base = 190, max = Math.max(1, ...serie.map((d) => d.visitas));
  const w = L / serie.length, larg = Math.max(4, w * 0.62);
  const passo = Math.ceil(serie.length / 10);
  return `<svg class="mt-graf" viewBox="0 0 ${L} ${A}" role="img" aria-label="${esc(t('dia'))}">
    <line x1="0" y1="${base}" x2="${L}" y2="${base}" class="mt-graf__base"/>
    ${serie.map((d, i) => {
      const x = i * w + (w - larg) / 2, hv = (d.visitas / max) * 160, hc = (d.contatos / max) * 160;
      return `<rect x="${x}" y="${base - hv}" width="${larg}" height="${hv}" rx="3" class="mt-graf__v"><title>${dataCurta(d.dia)}: ${d.visitas}</title></rect>
        ${d.contatos ? `<rect x="${x}" y="${base - hc}" width="${larg}" height="${hc}" rx="3" class="mt-graf__c"><title>${d.contatos}</title></rect>` : ''}
        ${i % passo === 0 ? `<text x="${x + larg / 2}" y="${base + 20}" text-anchor="middle" class="mt-graf__dia">${dataCurta(d.dia)}</text>` : ''}`;
    }).join('')}
  </svg>
  <p class="mt-legenda"><i class="mt-ponto"></i>${esc(t('visitas'))} <i class="mt-ponto mt-ponto--c"></i>${esc(t('contatos'))}</p>`;
}

/* Lista de barras horizontais. */
function barras(itens, rotulo = (x) => x.nome) {
  const max = Math.max(1, ...itens.map((i) => i.n));
  return `<ul class="mt-barras">${itens.map((i) => `<li><span class="mt-barras__nome">${esc(rotulo(i))}</span>
    <span class="mt-barras__trilho"><span style="width:${(i.n / max) * 100}%"></span></span><b>${num(i.n)}</b></li>`).join('')}</ul>`;
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
  const a = r.atual, b = r.anterior;
  const ini = a.dias[0].dia, fim = a.dias.at(-1).dia;
  const funil = [
    { nome: t('visitantes'), n: a.visitantes },
    { nome: t('comecaram'), n: a.formInicio },
    { nome: t('enviaram'), n: a.leads },
  ];
  const acoes = [
    { nome: t('ligar'), n: a.ligar }, { nome: t('whatsapp'), n: a.whatsapp }, { nome: t('email'), n: a.email },
    { nome: t('mapa'), n: a.mapa }, { nome: t('social'), n: a.social }, { nome: t('sms'), n: a.sms },
  ].filter((x) => x.n);
  const pctCel = a.visitas ? Math.round((a.celular / a.visitas) * 100) : 0;
  el.innerHTML = `
    <header class="mt-cab">
      <div>
        <p class="mt-eyebrow">${esc(t('eyebrow'))}</p>
        <h2 class="mt-titulo">${esc(r.site.nome)}</h2>
        <p class="mt-sub">${esc(r.site.dominios[0])} · ${esc(t('periodo'))}: ${dataCurta(ini)} ${esc(t('ate'))} ${dataCurta(fim)}</p>
      </div>
      <p class="mt-sub mt-sub--dir">${esc(t('comp'))}</p>
    </header>
    ${a.visitas ? '' : `<p class="mt-vazio">${esc(t('vazio'))}</p>`}
    <section class="mt-cards">
      ${cartao(t('visitas'), num(a.visitas), a.visitas, b.visitas)}
      ${cartao(t('visitantes'), num(a.visitantes), a.visitantes, b.visitantes)}
      ${cartao(t('contatos'), num(a.contatos), a.contatos, b.contatos, true)}
      ${cartao(t('leads'), num(a.leads), a.leads, b.leads)}
      ${cartao(t('ligar'), num(a.ligar), a.ligar, b.ligar)}
      ${cartao(t('tempo'), tempo(a.tempoMedio), a.tempoMedio, b.tempoMedio)}
    </section>
    <section class="mt-bloco"><h3>${esc(t('dia'))}</h3>${grafico(a.dias)}</section>
    <section class="mt-dupla">
      <div class="mt-bloco"><h3>${esc(t('funil'))}</h3>${barras(funil)}</div>
      <div class="mt-bloco"><h3>${esc(t('acoes'))}</h3>${acoes.length ? barras(acoes) : '<p class="mt-sub">0</p>'}</div>
    </section>
    <section class="mt-tripla">
      <div class="mt-bloco"><h3>${esc(t('origens'))}</h3>${a.origens.length ? barras(a.origens, (x) => x.nome === 'direto' ? t('direto') : x.nome.replace(/^./, (c) => c.toUpperCase())) : '<p class="mt-sub">0</p>'}</div>
      <div class="mt-bloco"><h3>${esc(t('paginas'))}</h3>${a.paginas.length ? barras(a.paginas) : '<p class="mt-sub">0</p>'}</div>
      <div class="mt-bloco"><h3>${esc(t('aparelho'))}</h3>
        <div class="mt-anel" style="--p:${pctCel}"><span><b>${pctCel}%</b>${esc(t('celular'))}</span></div>
        <p class="mt-legenda"><i class="mt-ponto mt-ponto--c"></i>${esc(t('celular'))} ${num(a.celular)} <i class="mt-ponto"></i>${esc(t('computador'))} ${num(a.visitas - a.celular)}</p>
      </div>
    </section>
    <footer class="mt-pe"><span>${esc(t('rodape'))} · samuelfreire.com.br</span><span>${esc(t('gerado'))} ${new Date(r.geradoEm).toLocaleString(lingua === 'en' ? 'en-US' : 'pt-BR', { dateStyle: 'medium', timeStyle: 'short' })}</span></footer>`;
}

async function carregar() {
  const id = $('#site').value;
  $('#sincronizar').disabled = true;
  try {
    if (id) atual = await api(`metricas/${encodeURIComponent(id)}?dias=${dias}`);
    else { atual = null; geral = (await api(`metricas?dias=${dias}`)).geral; }
    render();
  }
  catch (e) { if (e.message) aviso(e.message, 'erro'); }
  finally { $('#sincronizar').disabled = false; }
}

function montarSites(escolher) {
  $('#site').innerHTML = '<option value="">Todos os sites</option>' + sites.map((s) => `<option value="${esc(s.id)}">${esc(s.nome)}</option>`).join('');
  if (escolher) $('#site').value = escolher;
  $('#lista-sites').innerHTML = sites.length
    ? sites.map((s) => `<li><b>${esc(s.nome)}</b> <span>${esc(s.id)} · ${esc(s.dominios.join(', '))}</span> <button type="button" class="mini" data-codigo="${esc(s.id)}">Código</button> <button type="button" class="mini mini--perigo" data-apagar="${esc(s.id)}">Apagar</button></li>`).join('')
    : '<li class="mt-sub">Nenhum site ainda.</li>';
}

function mostrarCodigo(id) {
  $('#codigo-texto').textContent = `<script src="${location.origin}/m.js" data-site="${id}" defer></script>`;
  $('#codigo').hidden = false;
}

async function iniciar() {
  try { sites = (await api('metricas')).sites.sort((a, b) => a.nome.localeCompare(b.nome)); } catch { return; }
  const pedido = new URLSearchParams(location.search).get('site');
  montarSites(sites.some((s) => s.id === pedido) ? pedido : undefined);
  carregar();
}

$('#site').addEventListener('change', carregar);
$('#relatorio').addEventListener('click', (e) => { const b = e.target.closest('[data-abrir]'); if (b) { $('#site').value = b.dataset.abrir; carregar(); } });
$('#sincronizar').addEventListener('click', async () => { await carregar(); aviso('Dados atualizados.'); });
$('#pdf').addEventListener('click', () => window.print());
for (const [grupo, chave, fn] of [['#periodo', 'dias', (v) => { dias = Number(v); carregar(); }], ['#idioma', 'lingua', (v) => { lingua = v; render(); }]]) {
  $(grupo).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    $(grupo).querySelectorAll('button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    fn(b.dataset[chave]);
  });
}
$('#abrir-sites').addEventListener('click', () => $('#jan').showModal());
$('#jan-fechar').addEventListener('click', () => $('#jan').close());
$('#lista-sites').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-codigo]'); if (b) return mostrarCodigo(b.dataset.codigo);
  const ap = e.target.closest('[data-apagar]'); if (!ap) return;
  const s = sites.find((x) => x.id === ap.dataset.apagar);
  if (!confirm(`Apagar "${s.nome}" das métricas? Ele some da lista e para de contar. Os números ficam guardados no servidor.`)) return;
  try {
    await api('metricas/' + encodeURIComponent(s.id), { method: 'DELETE' });
    sites = sites.filter((x) => x.id !== s.id);
    if ($('#site').value === s.id) $('#site').value = '';
    montarSites($('#site').value || undefined); $('#codigo').hidden = true; carregar();
    aviso('Site apagado.');
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
});
$('#copiar').addEventListener('click', async () => { await navigator.clipboard.writeText($('#codigo-texto').textContent); aviso('Código copiado.'); });
$('#form-site').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  try {
    const { site } = await api('metricas', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nome: f.nome.value, id: f.elements.namedItem('id').value, dominios: f.dominios.value }) });
    sites = [...sites.filter((s) => s.id !== site.id), site].sort((a, b) => a.nome.localeCompare(b.nome));
    montarSites(site.id); mostrarCodigo(site.id); carregar();
    aviso('Site salvo.');
  } catch (err) { if (err.message) aviso(err.message, 'erro'); }
});

iniciar();
