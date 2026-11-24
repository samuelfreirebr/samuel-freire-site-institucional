/* ============================================================
   Relatório do site: números, gráfico por dia, funil, cliques,
   origens, páginas e aparelho. O mesmo desenho no painel do
   Samuel (/admin/metricas) e no painel do cliente (/cliente),
   para os dois verem a mesma coisa. Fica em /cliente/ porque o
   cliente não entra no /admin. Estilos em relatorio.css.
   ============================================================ */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const TXT = {
  pt: {
    eyebrow: 'Relatório do site', periodo: 'Período', ate: 'a', comp: 'vs. período anterior',
    visitas: 'Visitas', visitantes: 'Pessoas diferentes', contatos: 'Contatos gerados', leads: 'Pedidos de orçamento',
    ligar: 'Cliques em ligar', tempo: 'Tempo médio no site',
    dia: 'Visitas e contatos por dia', funil: 'Do visitante ao orçamento', comecaram: 'Começaram o formulário', enviaram: 'Enviaram o pedido',
    acoes: 'O que as pessoas clicaram', whatsapp: 'WhatsApp', email: 'E-mail', mapa: 'Mapa / rotas', social: 'Redes sociais', sms: 'SMS',
    origens: 'De onde vieram', paginas: 'Páginas mais vistas', aparelho: 'Aparelho', celular: 'Celular', computador: 'Computador',
    direto: 'Direto (digitou ou salvou)', vazio: 'Ainda não há dados neste período. Assim que alguém abrir o site, os números aparecem aqui.',
    rodape: 'Preparado por Samuel Freire', gerado: 'Gerado em', novo: 'novo',
    semCliques: 'Ainda ninguém clicou em ligar, WhatsApp, e-mail ou mapa.', semVisitas: 'Ainda sem visitas neste período.',
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
    semCliques: 'No one has clicked call, WhatsApp, email or map yet.', semVisitas: 'No visits in this period yet.',
  },
};

let lingua = 'pt', comparar = true;
export const usarLingua = (l) => { lingua = l; };
export const t = (k) => TXT[lingua][k] ?? k;
export const num = (n) => Number(n || 0).toLocaleString(lingua === 'en' ? 'en-US' : 'pt-BR');
export const dataCurta = (iso) => new Date(iso + 'T12:00').toLocaleDateString(lingua === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short' });
export const tempo = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

/* Variação contra o período anterior. */
export function variacao(agora, antes) {
  if (!comparar || (!antes && !agora)) return '';
  if (!antes) return `<span class="mt-var mt-var--sobe">${t('novo')}</span>`;
  const p = Math.round(((agora - antes) / antes) * 100);
  if (!p) return '<span class="mt-var">0%</span>';
  return `<span class="mt-var ${p > 0 ? 'mt-var--sobe' : 'mt-var--desce'}">${p > 0 ? '↑' : '↓'} ${Math.abs(p)}%</span>`;
}

export function cartao(rotulo, valor, agora, antes, destaque) {
  return `<div class="mt-card${destaque ? ' mt-card--destaque' : ''}"><p class="mt-card__rot">${esc(rotulo)}</p><p class="mt-card__num">${valor}</p>${variacao(agora, antes)}</div>`;
}

/* Barras por dia: visitas (cinza) e contatos (laranja). SVG puro. */
function grafico(serie) {
  const poucos = serie.filter((d) => d.visitas).length <= 3;
  /* No celular o desenho é mais estreito: barras e datas saem maiores. */
  const L = matchMedia('(max-width: 620px)').matches ? 400 : 900, A = poucos ? 120 : 220, base = A - 30, alto = base - 20, max = Math.max(1, ...serie.map((d) => d.visitas));
  const w = L / serie.length, larg = Math.max(4, w * 0.62);
  const passo = Math.ceil(serie.length / 10);
  return `<svg class="mt-graf" viewBox="0 0 ${L} ${A}" role="img" aria-label="${esc(t('dia'))}">
    <line x1="0" y1="${base}" x2="${L}" y2="${base}" class="mt-graf__base"/>
    ${serie.map((d, i) => {
      const x = i * w + (w - larg) / 2, hv = (d.visitas / max) * alto, hc = (d.contatos / max) * alto;
      return `<rect x="${x}" y="${base - hv}" width="${larg}" height="${hv}" rx="3" class="mt-graf__v"><title>${dataCurta(d.dia)}: ${d.visitas}</title></rect>
        ${d.contatos ? `<rect x="${x}" y="${base - hc}" width="${larg}" height="${hc}" rx="3" class="mt-graf__c"><title>${d.contatos}</title></rect>` : ''}
        ${i % passo === 0 ? `<text x="${x + larg / 2}" y="${base + 20}" text-anchor="middle" class="mt-graf__dia${(i / passo) % 2 ? ' mt-graf__dia--impar' : ''}">${dataCurta(d.dia)}</text>` : ''}`;
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

/* Corpo do relatório. r = resposta de metricas.resumo (atual e anterior).
   comparar: false esconde as setas (no Máximo não há período anterior). */
export function relatorio(r, opcoes = {}) {
  lingua = opcoes.lingua || lingua; comparar = opcoes.comparar !== false;
  const a = r.atual, b = r.anterior;
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
  return `
    ${a.visitas ? '' : `<p class="mt-vazio">${esc(t('vazio'))}</p>`}
    <section class="mt-cards">
      ${cartao(t('visitas'), num(a.visitas), a.visitas, b.visitas)}
      ${cartao(t('visitantes'), num(a.visitantes), a.visitantes, b.visitantes)}
      ${cartao(t('contatos'), num(a.contatos), a.contatos, b.contatos, true)}
      ${cartao(t('leads'), num(a.leads), a.leads, b.leads)}
      ${cartao(t('ligar'), num(a.ligar), a.ligar, b.ligar)}
      ${cartao(t('tempo'), tempo(a.tempoMedio), a.tempoMedio, b.tempoMedio)}
    </section>
    ${opcoes.depois || ''}
    <section class="mt-bloco"><h3>${esc(t('dia'))}</h3>${grafico(a.dias)}</section>
    <section class="mt-dupla">
      <div class="mt-bloco"><h3>${esc(t('funil'))}</h3>${barras(funil)}</div>
      <div class="mt-bloco"><h3>${esc(t('acoes'))}</h3>${acoes.length ? barras(acoes) : `<p class="mt-sub">${esc(t('semCliques'))}</p>`}</div>
    </section>
    <section class="mt-tripla">
      <div class="mt-bloco"><h3>${esc(t('origens'))}</h3>${a.origens.length ? barras(a.origens, (x) => x.nome === 'direto' ? t('direto') : x.nome.replace(/^./, (c) => c.toUpperCase())) : `<p class="mt-sub">${esc(t('semVisitas'))}</p>`}</div>
      <div class="mt-bloco"><h3>${esc(t('paginas'))}</h3>${a.paginas.length ? barras(a.paginas) : `<p class="mt-sub">${esc(t('semVisitas'))}</p>`}</div>
      <div class="mt-bloco"><h3>${esc(t('aparelho'))}</h3>${a.visitas ? `
        <div class="mt-anel" style="--p:${pctCel}"><span><b>${pctCel}%</b>${esc(t('celular'))}</span></div>
        <p class="mt-legenda"><i class="mt-ponto mt-ponto--c"></i>${esc(t('celular'))} ${num(a.celular)} <i class="mt-ponto"></i>${esc(t('computador'))} ${num(a.visitas - a.celular)}</p>` : `<p class="mt-sub">${esc(t('semVisitas'))}</p>`}
      </div>
    </section>
`;
}
