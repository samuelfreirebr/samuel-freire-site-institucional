/* ============================================================
   Lembretes no celular (avisos do próprio painel, servidor/push.js).

   8h: a lista do dia. Tarefas do CRM atrasadas, de hoje, urgentes e
   dos próximos dias; follow-ups de leads; prazos de projetos; tarefas
   do ClickUp; faturas vencidas ou vencendo.
   14h: só o que ainda está aberto para hoje ou atrasado, se houver.

   Cada envio acontece uma vez por dia (marcado em lembretes.json no
   volume, para não repetir quando o servidor reinicia).
   ============================================================ */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { RAIZ_DADOS, listarFaturas } from './dados.js';
import * as crm from './crm.js';
import * as clickup from './clickup.js';
import { situacao } from './fatura-html.js';
import * as push from './push.js';

const ARQ = path.join(RAIZ_DADOS, 'lembretes.json');
const MANHA = 8, TARDE = 14;
const POR_GRUPO = 8;       // o aviso tem limite de tamanho: o resto vira "e mais N"
const PROXIMOS_DIAS = 3;

const agoraSp = () => {
  const d = new Date();
  const dia = d.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
  const hora = Number(d.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false })) % 24;
  return { dia, hora };
};
const somar = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const ddmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const urgente = (p) => p === 'urgente' || p === 'alta';

/* Junta tudo o que tem data ou urgência, já com o nome do cliente.
   item: { titulo, cliente, prazo, prioridade, tipo } */
export function juntar({ clientes = [], clickup: tarefasCu = [], faturas = [] }, hoje) {
  const itens = [];
  for (const c of clientes) {
    const quem = c.interno ? '' : c.nome;
    for (const a of c.atividades || []) {
      if (a.estado === 'feita') continue;
      itens.push({ tipo: 'tarefa', titulo: a.titulo, cliente: quem, prazo: a.prazo || '', prioridade: a.prioridade || 'normal', aguardando: a.estado === 'aguardando' });
    }
    for (const p of c.projetos || []) {
      if (p.estado === 'entregue' || p.estado === 'pausado' || !p.prazo) continue;
      itens.push({ tipo: 'projeto', titulo: `Prazo do projeto ${p.nome}`, cliente: quem, prazo: p.prazo, prioridade: 'normal' });
    }
    if (!c.interno && c.proximoContato && !['encerrado', 'entregue'].includes(c.etapa)) {
      itens.push({ tipo: 'contato', titulo: c.proximoPasso ? `Falar com ${c.nome}: ${c.proximoPasso}` : `Falar com ${c.nome}`, cliente: '', prazo: c.proximoContato, prioridade: 'normal' });
    }
  }
  for (const t of tarefasCu) itens.push({ tipo: 'clickup', titulo: t.titulo, cliente: t.cliente, prazo: t.prazo || '', prioridade: 'normal', aguardando: t.estado === 'aguardando' });
  for (const f of faturas) {
    if (situacao(f) === 'paga' || !f.vencimento) continue;
    itens.push({ tipo: 'fatura', titulo: `Fatura ${f.codigo || ''} de ${f.cliente?.nome || f.cliente || 'cliente'}`.replace(/\s+/g, ' '), cliente: '', prazo: f.vencimento, prioridade: 'normal' });
  }
  const limite = somar(hoje, PROXIMOS_DIAS);
  return {
    atrasadas: itens.filter((i) => i.prazo && i.prazo < hoje && !i.aguardando).sort((a, b) => a.prazo.localeCompare(b.prazo)),
    hoje: itens.filter((i) => i.prazo === hoje && !i.aguardando),
    urgentes: itens.filter((i) => !i.prazo && urgente(i.prioridade) && !i.aguardando),
    proximos: itens.filter((i) => i.prazo > hoje && i.prazo <= limite && !i.aguardando).sort((a, b) => a.prazo.localeCompare(b.prazo)),
    aguardando: itens.filter((i) => i.aguardando && i.prazo && i.prazo <= hoje),
  };
}

const linha = (i, comData) => `• ${i.titulo}${i.cliente ? ` (${i.cliente})` : ''}${comData && i.prazo ? `, ${ddmm(i.prazo)}` : ''}`;
function grupo(nome, lista, comData) {
  if (!lista.length) return '';
  const mais = lista.length > POR_GRUPO ? `\n  e mais ${lista.length - POR_GRUPO}` : '';
  return `${nome} (${lista.length})\n${lista.slice(0, POR_GRUPO).map((i) => linha(i, comData)).join('\n')}${mais}`;
}

/* Texto do aviso. manha = lista completa; tarde = só o que ainda é de hoje ou atrasado. */
export function montar(g, manha) {
  const blocos = manha
    ? [grupo('ATRASADAS', g.atrasadas, true), grupo('HOJE', g.hoje), grupo('URGENTES SEM DATA', g.urgentes), grupo('PRÓXIMOS DIAS', g.proximos, true), grupo('ESPERANDO RESPOSTA (passou do prazo)', g.aguardando, true)]
    : [grupo('AINDA PARA HOJE', g.hoje), grupo('ATRASADAS', g.atrasadas, true)];
  const texto = blocos.filter(Boolean).join('\n\n');
  return texto.length > 3000 ? texto.slice(0, 2990) + '…' : texto;
}

async function lerMarcas() { try { return JSON.parse(await fs.readFile(ARQ, 'utf8')); } catch { return {}; } }

async function conferir() {
  const { dia, hora } = agoraSp();
  const turno = hora >= TARDE ? 'tarde' : hora >= MANHA ? 'manha' : null;
  if (!turno) return;
  const marcas = await lerMarcas();
  if (marcas[turno] === dia) return;
  marcas[turno] = dia;
  if (turno === 'tarde' && marcas.manha !== dia) marcas.manha = dia;   // reiniciou à tarde: não manda a da manhã atrasada
  await fs.writeFile(ARQ, JSON.stringify(marcas), 'utf8');

  const [clientes, faturas, cu] = await Promise.all([
    crm.listar(),
    listarFaturas().catch(() => []),
    clickup.ligado() ? clickup.tarefas().catch(() => ({ tarefas: [] })) : { tarefas: [] },
  ]);
  const g = juntar({ clientes, faturas, clickup: cu.tarefas }, dia);
  const texto = montar(g, turno === 'manha');
  if (!texto) return;
  const pendentes = g.atrasadas.length + g.hoje.length;
  await push.avisar({
    titulo: turno === 'manha' ? `📋 Para hoje, ${ddmm(dia)}` : `⏰ Ainda para hoje: ${pendentes}`,
    texto,
    url: '/admin/',
  });
}

/* Confere a cada 10 minutos. */
export function iniciar() {
  const vez = () => conferir().catch((e) => console.error('[lembretes]', e.message));
  vez();
  setInterval(vez, 10 * 60 * 1000).unref();
}
