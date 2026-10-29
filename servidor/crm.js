/* ============================================================
   CRM: em que pé está cada cliente. Só o painel enxerga, e o
   Claude, pela chave TOKEN_CLAUDE (ver servidor.js).

   Tudo num arquivo só (/dados/crm.json), como o Cofre: são dezenas
   de clientes, e o quadro e os filtros rodam no navegador.

   Nada se apaga daqui: cliente que sai vai para "Encerrado". A
   linha do tempo só cresce.
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
export const ESTADOS_ATIVIDADE = ['hoje', 'semana', 'aguardando', 'backlog', 'feita'];
const MAX_LINHA = 500;   // por cliente: anos de histórico

let fila = Promise.resolve();
const naFila = (fn) => { const r = fila.then(fn, fn); fila = r.catch(() => {}); return r; };
const novoId = () => randomBytes(6).toString('hex');
const corte = (v, max) => String(v ?? '').trim().slice(0, max);
const data = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '';

export async function listar() {
  try { return JSON.parse(await fs.readFile(ARQ, 'utf8')); }
  catch (e) { return []; }
}

async function gravar(lista) {
  await fs.mkdir(RAIZ_DADOS, { recursive: true });
  await fs.writeFile(ARQ + '.tmp', JSON.stringify(lista, null, 2), 'utf8');
  await fs.rename(ARQ + '.tmp', ARQ);
}

function limparAtividades(lista) {
  return (Array.isArray(lista) ? lista : []).slice(0, 200).map((a) => ({
    id: corte(a.id, 20) || novoId(),
    titulo: corte(a.titulo, 300),
    estado: ESTADOS_ATIVIDADE.includes(a.estado) ? a.estado : 'backlog',
    prazo: data(a.prazo),
    origem: a.origem === 'claude' ? 'claude' : 'painel',
  })).filter((a) => a.titulo);
}

function limpar(d) {
  const nome = corte(d.nome, 160);
  if (!nome) throw new Error('Dê um nome ao cliente.');
  return {
    nome,
    etapa: ETAPAS.some((e) => e.id === d.etapa) ? d.etapa : 'lead',
    servico: corte(d.servico, 300),
    proximoPasso: corte(d.proximoPasso, 500),
    contato: corte(d.contato, 300),
    notas: corte(d.notas, 8000),
    /* Contrato. Valor vazio fica null: o Samuel preenche, ninguém chuta. */
    tipo: ['recorrente', 'pontual'].includes(d.tipo) ? d.tipo : '',
    valor: d.valor === '' || d.valor == null || !(Number(d.valor) >= 0) ? null : Math.round(Number(d.valor) * 100) / 100,
    moeda: /^[A-Z]{3}$/.test(d.moeda || '') ? d.moeda : 'BRL',
    inicio: data(d.inicio),
    fim: data(d.fim),
    atividades: limparAtividades(d.atividades),
  };
}

/* Sem id (e sem cliente com o mesmo nome) cria; com id, mistura só os
   campos enviados. Assim o Claude manda {id, etapa} e o resto fica.
   Mudança de etapa entra sozinha na linha do tempo. */
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
    if (!antigo) linha.push({ id: novoId(), data: agora, texto: 'Cliente criado no CRM.', origem });
    else if (antigo.etapa !== item.etapa) {
      const nome = ETAPAS.find((e) => e.id === item.etapa).nome;
      linha.push({ id: novoId(), data: agora, texto: `Etapa: ${nome}.`, origem });
    }
    const salvo = { ...antigo, ...item, id: antigo?.id || novoId(), linha: linha.slice(-MAX_LINHA), criadoEm: antigo?.criadoEm || agora, atualizadoEm: agora };
    if (i >= 0) lista[i] = salvo; else lista.unshift(salvo);
    await gravar(lista);
    return salvo;
  });
}

export function anotar(id, texto, origem = 'painel') {
  return naFila(async () => {
    const t = corte(texto, 4000);
    if (!t) throw new Error('Escreva o que aconteceu.');
    const lista = await listar();
    const c = lista.find((x) => x.id === id);
    if (!c) throw new Error('Cliente não encontrado.');
    const agora = new Date().toISOString();
    c.linha = [...(c.linha || []), { id: novoId(), data: agora, texto: t, origem }].slice(-MAX_LINHA);
    c.atualizadoEm = agora;
    await gravar(lista);
    return c;
  });
}
