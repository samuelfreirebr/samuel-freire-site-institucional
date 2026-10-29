/* ============================================================
   CRM: em que pé está cada cliente e cada tarefa. Só o painel
   enxerga, e o Claude, pela chave TOKEN_CLAUDE (ver servidor.js).

   Tudo num arquivo só (/dados/crm.json), como o Cofre: são dezenas
   de clientes, e o quadro, a central de tarefas e os filtros rodam
   no navegador.

   Tarefa da empresa, sem cliente, mora num registro marcado como
   "interno", que não aparece no funil nem na lista de clientes.

   Nada se apaga daqui: cliente que sai vai para "Encerrado", tarefa
   vai para "Feita". A linha do tempo só cresce.
   ============================================================ */

import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { RAIZ_DADOS } from './dados.js';

const ARQ = path.join(RAIZ_DADOS, 'crm.json');

export const ETAPAS = [
  { id: 'lead', nome: 'Lead' },
  { id: 'proposta', nome: 'Proposta enviada' },
  { id: 'fechado', nome: 'Fechado, sem começar' },
  { id: 'andamento', nome: 'Em andamento' },
  { id: 'entregue', nome: 'Entregue / Manutenção' },
  { id: 'encerrado', nome: 'Encerrado' },
];
export const ESTADOS_ATIVIDADE = ['afazer', 'andamento', 'aguardando', 'feita'];
export const PRIORIDADES = ['urgente', 'alta', 'normal', 'baixa'];
export const ORIGENS = ['whatsapp', 'instagram', 'indicacao', 'prospeccao', 'site', 'outro'];
export const ESTADOS_PROJETO = ['proximo', 'andamento', 'pausado', 'entregue'];
export const ESTADOS_CLAUDE = ['', 'fila', 'trabalhando', 'feita'];
const MAX_LINHA = 500;   // por cliente: anos de histórico

let fila = Promise.resolve();
const naFila = (fn) => { const r = fila.then(fn, fn); fila = r.catch(() => {}); return r; };
const novoId = () => randomBytes(6).toString('hex');
const corte = (v, max) => String(v ?? '').trim().slice(0, max);
const data = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';
const umDe = (lista, v, padrao) => (lista.includes(v) ? v : padrao);
const link = (v) => { const u = corte(v, 2000); return /^https?:\/\//i.test(u) ? u : ''; };
const idDe = (v) => corte(v, 20) || novoId();

export async function listar() {
  try { return JSON.parse(await fs.readFile(ARQ, 'utf8')); }
  catch (e) { return []; }
}

async function gravar(lista) {
  await fs.mkdir(RAIZ_DADOS, { recursive: true });
  await fs.writeFile(ARQ + '.tmp', JSON.stringify(lista, null, 2), 'utf8');
  await fs.rename(ARQ + '.tmp', ARQ);
}

/* Tarefa antiga tinha estado hoje/semana/backlog: o prazo já diz
   quando, então viram "a fazer". */
function limparAtividades(lista) {
  const agora = new Date().toISOString();
  return (Array.isArray(lista) ? lista : []).slice(0, 300).map((a) => {
    const estado = ESTADOS_ATIVIDADE.includes(a.estado) ? a.estado : 'afazer';
    return {
      id: idDe(a.id),
      titulo: corte(a.titulo, 300),
      descricao: corte(a.descricao, 4000),
      estado,
      prioridade: umDe(PRIORIDADES, a.prioridade, 'normal'),
      tipo: a.tipo === 'entrega' ? 'entrega' : 'tarefa',
      prazo: data(a.prazo),
      projeto: corte(a.projeto, 20),
      checklist: (Array.isArray(a.checklist) ? a.checklist : []).slice(0, 50)
        .map((i) => ({ texto: corte(i.texto, 300), feito: Boolean(i.feito) })).filter((i) => i.texto),
      claude: umDe(ESTADOS_CLAUDE, a.claude, ''),
      notaClaude: corte(a.notaClaude, 4000),
      origem: a.origem === 'claude' ? 'claude' : 'painel',
      criadaEm: a.criadaEm || agora,
      concluidaEm: estado === 'feita' ? (a.concluidaEm || agora) : '',
    };
  }).filter((a) => a.titulo);
}

function limpar(d) {
  const nome = corte(d.nome, 160);
  if (!nome) throw new Error('Dê um nome ao cliente.');
  return {
    nome,
    interno: Boolean(d.interno),
    etapa: ETAPAS.some((e) => e.id === d.etapa) ? d.etapa : 'lead',
    servico: corte(d.servico, 300),
    proximoPasso: corte(d.proximoPasso, 500),
    contato: corte(d.contato, 300),
    notas: corte(d.notas, 8000),
    // Lead: de onde veio, quando falar de novo e, se não fechou, por quê.
    origemLead: umDe(ORIGENS, d.origemLead, ''),
    proximoContato: data(d.proximoContato),
    motivoPerda: corte(d.motivoPerda, 500),
    tipo: ['recorrente', 'pontual'].includes(d.tipo) ? d.tipo : '',
    // Valor e moeda continuam guardados, mas o CRM não mostra dinheiro.
    valor: d.valor === '' || d.valor == null || !(Number(d.valor) >= 0) ? null : Math.round(Number(d.valor) * 100) / 100,
    moeda: /^[A-Z]{3}$/.test(d.moeda || '') ? d.moeda : 'BRL',
    inicio: data(d.inicio),
    fim: data(d.fim),
    atividades: limparAtividades(d.atividades),
    projetos: (Array.isArray(d.projetos) ? d.projetos : []).slice(0, 50).map((p) => ({
      id: idDe(p.id), nome: corte(p.nome, 200), estado: umDe(ESTADOS_PROJETO, p.estado, 'proximo'),
      inicio: data(p.inicio), prazo: data(p.prazo), descricao: corte(p.descricao, 2000),
    })).filter((p) => p.nome),
    materiais: (Array.isArray(d.materiais) ? d.materiais : []).slice(0, 100).map((m) => ({
      id: idDe(m.id), nome: corte(m.nome, 200), estado: m.estado === 'recebido' ? 'recebido' : 'falta', link: link(m.link),
    })).filter((m) => m.nome),
  };
}

/* Sem id (e sem cliente com o mesmo nome) cria; com id, mistura só os
   campos enviados. Assim o Claude manda {id, etapa} e o resto fica.
   Mudança de etapa e tarefa concluída entram sozinhas na linha do
   tempo; a data em que entrou na etapa conta os "dias na etapa". */
export function salvar(dado, origem = 'painel') {
  return naFila(async () => {
    const lista = await listar();
    const agora = new Date().toISOString();
    let i = dado.id ? lista.findIndex((x) => x.id === dado.id) : -1;
    if (dado.id && i < 0) throw new Error('Cliente não encontrado.');
    if (i < 0 && dado.nome) i = lista.findIndex((x) => x.nome.toLowerCase() === corte(dado.nome, 160).toLowerCase());
    const antigo = i >= 0 ? lista[i] : null;
    const item = limpar({ ...antigo, ...dado });
    const linha = antigo?.linha ? [...antigo.linha] : [];
    const anota = (texto) => linha.push({ id: novoId(), data: agora, texto, origem, tipo: 'evento' });
    let etapaDesde = antigo?.etapaDesde || antigo?.criadoEm || agora;
    if (!antigo) anota(item.interno ? 'Tarefas da empresa criadas no CRM.' : 'Cliente criado no CRM.');
    else if (antigo.etapa !== item.etapa) {
      anota(`Etapa: ${ETAPAS.find((e) => e.id === item.etapa).nome}.`);
      etapaDesde = agora;
    }
    const antes = new Map((antigo?.atividades || []).map((a) => [a.id, a]));
    for (const a of item.atividades) {
      const velha = antes.get(a.id);
      if (a.estado === 'feita' && velha && velha.estado !== 'feita') anota(`Concluída: ${a.titulo}.`);
      if (a.claude === 'fila' && velha?.claude !== 'fila') anota(`Enviada para o Claude: ${a.titulo}.`);
    }
    const salvo = { ...antigo, ...item, id: antigo?.id || novoId(), etapaDesde, linha: linha.slice(-MAX_LINHA), criadoEm: antigo?.criadoEm || agora, atualizadoEm: agora };
    if (i >= 0) lista[i] = salvo; else lista.unshift(salvo);
    await gravar(lista);
    return salvo;
  });
}

// tipo "nota" é anotação escrita (aba Notas); "evento" é o que aconteceu.
export function anotar(id, texto, origem = 'painel', tipo = 'evento') {
  return naFila(async () => {
    const t = corte(texto, 4000);
    if (!t) throw new Error('Escreva o que aconteceu.');
    const lista = await listar();
    const c = lista.find((x) => x.id === id);
    if (!c) throw new Error('Cliente não encontrado.');
    const agora = new Date().toISOString();
    c.linha = [...(c.linha || []), { id: novoId(), data: agora, texto: t, origem, tipo: tipo === 'nota' ? 'nota' : 'evento' }].slice(-MAX_LINHA);
    c.atualizadoEm = agora;
    await gravar(lista);
    return c;
  });
}
