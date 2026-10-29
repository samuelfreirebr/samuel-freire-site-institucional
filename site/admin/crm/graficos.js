/* Gráficos e grafismo dos dashboards (Início e Visão geral do CRM).
   SVG e HTML puros, sem biblioteca. Cada função devolve HTML pronto;
   as cores saem dos tokens pelo CSS (crm.css, seção "Gráficos").
   Nada aqui mostra dinheiro: só ritmo de trabalho. */

import { esc, hojeIso, somarDias, todasTarefas, grupoPrazo, visiveis, leadPedeAtencao } from './comum.js';

const DIAS = 14;   // janela dos gráficos de ritmo e de prazos

const diaIso = (iso) => new Date(iso).toLocaleDateString('en-CA');
const nomeDia = (iso) => new Date(iso + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

/* ---------- números para os gráficos ---------- */

export function ritmo(clientes) {
  // Concluídas por dia: a linha do tempo registra "Concluída: ..." a cada tarefa feita.
  const dias = Array.from({ length: DIAS }, (_, i) => ({ iso: somarDias(i - DIAS + 1), feitas: 0, mexidas: 0 }));
  for (const c of clientes) for (const l of c.linha || []) {
    const d = dias.find((x) => x.iso === diaIso(l.data));
    if (!d) continue;
    d.mexidas++;
    if (l.texto.startsWith('Concluída:')) d.feitas++;
  }
  return dias;
}

export function semana(clientes) {
  // Progresso da semana: feitas nos últimos 7 dias contra o que vence até daqui a 7.
  const feitas = ritmo(clientes).slice(-7).reduce((n, d) => n + d.feitas, 0);
  const pendentes = todasTarefas(clientes).filter((t) => t.estado !== 'feita' && t.prazo && t.prazo <= somarDias(7)).length;
  const total = feitas + pendentes;
  return { feitas, pendentes, pct: total ? Math.round((feitas / total) * 100) : 0 };
}

/* ---------- peças visuais ---------- */

// Anel de progresso (0 a 100).
export function anel(pct, rotulo = '') {
  const r = 34, volta = 2 * Math.PI * r;
  return `<div class="g-anel" role="img" aria-label="${pct}% ${esc(rotulo)}">
    <svg viewBox="0 0 80 80"><circle class="g-anel__fundo" cx="40" cy="40" r="${r}"/>
      <circle class="g-anel__cheio" cx="40" cy="40" r="${r}" stroke-dasharray="${(pct / 100) * volta} ${volta}"/></svg>
    <b>${pct}%</b></div>`;
}

// Barras dos últimos 14 dias; hoje em laranja, dias sem nada só com o trilho.
export function barrasRitmo(dias) {
  const max = Math.max(1, ...dias.map((d) => d.feitas));
  const hoje = hojeIso();
  const total = dias.reduce((n, d) => n + d.feitas, 0);
  return `<div class="g-ritmo" role="img" aria-label="${total} tarefas concluídas nos últimos ${DIAS} dias">
    ${dias.map((d) => `<div class="g-ritmo__dia${d.iso === hoje ? ' hoje' : ''}" title="${d.iso.split('-').reverse().join('/')}: ${d.feitas} concluída(s), ${d.mexidas} movimento(s)">
      <span class="g-ritmo__n">${d.feitas || ''}</span>
      <span class="g-ritmo__barra" style="height:${d.feitas ? Math.max(8, (d.feitas / max) * 100) : 4}%"></span>
      <span class="g-ritmo__rot">${nomeDia(d.iso).slice(0, 3)}</span>
    </div>`).join('')}
  </div>`;
}

// Rosca das tarefas abertas por prioridade.
export function roscaPrioridade(clientes) {
  const abertas = todasTarefas(clientes).filter((t) => t.estado !== 'feita');
  const partes = [['urgente', 'Urgente'], ['alta', 'Alta'], ['normal', 'Normal'], ['baixa', 'Baixa']]
    .map(([k, nome]) => ({ k, nome, n: abertas.filter((t) => t.prioridade === k).length }));
  const total = abertas.length;
  const r = 30, volta = 2 * Math.PI * r;
  let andou = 0;
  const arcos = total ? partes.filter((p) => p.n).map((p) => {
    const tam = (p.n / total) * volta;
    const arco = `<circle class="g-rosca__parte" data-p="${p.k}" cx="40" cy="40" r="${r}" stroke-dasharray="${Math.max(0, tam - 2)} ${volta}" stroke-dashoffset="${-andou}"/>`;
    andou += tam;
    return arco;
  }).join('') : '';
  return `<div class="g-rosca">
    <div class="g-rosca__svg" role="img" aria-label="${total} tarefas abertas por prioridade">
      <svg viewBox="0 0 80 80"><circle class="g-anel__fundo" cx="40" cy="40" r="${r}"/>${arcos}</svg>
      <b>${total}<small>abertas</small></b>
    </div>
    <ul class="g-legenda">${partes.map((p) => `<li data-p="${p.k}"><span>${p.nome}</span><b>${p.n}</b></li>`).join('')}</ul>
  </div>`;
}

// Faixa dos próximos 14 dias: um ponto por prazo, entrega e follow-up em laranja.
export function faixaPrazos(clientes) {
  const tarefas = todasTarefas(clientes).filter((t) => t.estado !== 'feita' && t.prazo);
  const leads = visiveis(clientes).filter((c) => c.proximoContato);
  const hoje = hojeIso();
  const dias = Array.from({ length: DIAS }, (_, i) => somarDias(i));
  const atrasadas = tarefas.filter((t) => grupoPrazo(t) === 'atrasada').length;
  return `<div class="g-faixa">
    ${dias.map((iso) => {
      const ts = tarefas.filter((t) => t.prazo === iso);
      const ls = leads.filter((c) => c.proximoContato === iso);
      const pontos = [...ts.map((t) => (t.tipo === 'entrega' || t.prioridade === 'urgente' ? 'forte' : '')), ...ls.map(() => 'lead')];
      const d = new Date(iso + 'T12:00');
      return `<div class="g-faixa__dia${iso === hoje ? ' hoje' : ''}${[0, 6].includes(d.getDay()) ? ' fds' : ''}" title="${esc(ts.map((t) => t.titulo).concat(ls.map((c) => 'Falar com ' + c.nome)).join(' · ') || 'Livre')}">
        <span class="g-faixa__sem">${nomeDia(iso).slice(0, 3)}</span>
        <b>${d.getDate()}</b>
        <span class="g-faixa__pontos">${pontos.slice(0, 4).map((p) => `<i class="${p}"></i>`).join('')}${pontos.length > 4 ? `<small>+${pontos.length - 4}</small>` : ''}</span>
      </div>`;
    }).join('')}
  </div>
  ${atrasadas ? `<p class="g-faixa__aviso">${atrasadas} tarefa${atrasadas > 1 ? 's' : ''} atrasada${atrasadas > 1 ? 's' : ''} antes de hoje.</p>` : ''}`;
}

/* Cartão de boas-vindas: faixa escura com o anel da semana. */
export function boasVindas({ saudacao, frase, clientes }) {
  const s = semana(clientes);
  const leads = visiveis(clientes).filter(leadPedeAtencao).length;
  return `<section class="g-boas">
    <div class="g-boas__txt">
      <p class="g-boas__olho">${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h2>${esc(saudacao)}, Samuel</h2>
      <p>${esc(frase)}</p>
      <div class="g-boas__chips">
        <span><b>${s.feitas}</b> feitas em 7 dias</span>
        <span><b>${s.pendentes}</b> vencem nos próximos 7</span>
        <span><b>${leads}</b> lead${leads === 1 ? '' : 's'} para falar</span>
      </div>
    </div>
    <div class="g-boas__anel">${anel(s.pct, 'da semana')}<small>da semana feita</small></div>
  </section>`;
}
