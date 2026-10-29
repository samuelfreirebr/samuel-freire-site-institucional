/* ============================================================
   CRM: em que pé está cada cliente e cada tarefa. Só o painel
   enxerga, e o Claude, pela chave TOKEN_CLAUDE (ver servidor.js).

   Tudo num arquivo só (/dados/crm.json), como o Cofre: são dezenas
   de clientes, e o quadro, a central de tarefas e os filtros rodam
   no navegador.

   Tarefa da empresa, sem cliente, mora num registro marcado como
   "interno", que não aparece no funil nem na lista de clientes.

   Cliente que sai pode ir para "Encerrado" ou ser apagado pelo Samuel
   no painel. Tarefa feita vai para "Feita". A linha do tempo só cresce.
   ============================================================ */

import { promises as fs } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { RAIZ_DADOS } from './dados.js';
import { pedirJsonIa, temChaveIa, prepararAnexos, semTravessao } from './proposta-ia.js';

const ARQ = path.join(RAIZ_DADOS, 'crm.json');

export const ETAPAS = [
  // Até "Falta assinar ou pagar" ainda é lead; de "Fechado" em diante é cliente.
  { id: 'lead', nome: 'Lead' },
  { id: 'proposta', nome: 'Proposta enviada' },
  { id: 'followup', nome: 'Follow-up' },
  { id: 'assinatura', nome: 'Falta assinar ou pagar' },
  { id: 'fechado', nome: 'Fechado, sem começar' },
  { id: 'andamento', nome: 'Em produção' },
  { id: 'entregue', nome: 'Entregue' },
  { id: 'encerrado', nome: 'Encerrado' },
  { id: 'recorrente', nome: 'Recorrente ativo' },
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
    // Propostas do painel ligadas a este cliente (id da proposta = id do briefing e do contrato).
    propostas: [...new Set((Array.isArray(d.propostas) ? d.propostas : []).map((x) => corte(x, 61)).filter((x) => /^[a-z0-9][a-z0-9-]{1,60}$/.test(x)))].slice(0, 30),
    drive: link(d.drive),   // pasta do Drive com os materiais do cliente
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
    if (item.etapa === 'recorrente') item.tipo = 'recorrente';   // etapa de cliente fixo: a etiqueta vem junto
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

/* Apagar é do Samuel, logado no painel (a chave do Claude não apaga:
   o servidor recusa DELETE com ela antes de chegar aqui). */
export function apagar(id) {
  return naFila(async () => {
    const lista = await listar();
    const resto = lista.filter((x) => x.id !== id);
    if (resto.length === lista.length) return false;
    await gravar(resto);
    return true;
  });
}

/* ---------- Cadastro pela IA ----------
   O Samuel solta o que tiver (conversa do WhatsApp, print, PDF,
   proposta, foto do cartão) e a IA devolve a ficha preenchida. Nada é
   gravado aqui: a tela mostra o resultado no formulário para ele
   conferir e só então salva. */

const ESQUEMA_CADASTRO = {
  type: 'object', additionalProperties: false,
  required: ['nome', 'etapa', 'servico', 'contato', 'origemLead', 'proximoContato', 'proximoPasso', 'tipo', 'nota', 'tarefas'],
  properties: {
    nome: { type: 'string' },
    etapa: { type: 'string', enum: ETAPAS.map((e) => e.id) },
    servico: { type: 'string' },
    contato: { type: 'string' },
    origemLead: { type: 'string', enum: ['', ...ORIGENS] },
    proximoContato: { type: 'string' },
    proximoPasso: { type: 'string' },
    tipo: { type: 'string', enum: ['', 'recorrente', 'pontual'] },
    nota: { type: 'string' },
    tarefas: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['titulo', 'prazo'], properties: { titulo: { type: 'string' }, prazo: { type: 'string' } } } },
  },
};

const sistemaCadastro = (hoje) => `Você cadastra clientes e leads no CRM do Samuel Freire, web designer (sites, landing pages, criativos, identidade visual, sistemas) que atende o Brasil e negócios locais nos EUA.
Leia o material (conversa, print, documento, proposta, cartão) e devolva a ficha. Hoje é ${hoje}.
Regras:
- nome: nome da empresa; se não houver, o da pessoa. Sem inventar.
- etapa: lead (só conversa ou interesse), proposta (proposta enviada), fechado (aceitou, ainda não começou), andamento (projeto sendo feito), recorrente (cliente fixo com contrato mensal ativo), entregue (projeto entregue), encerrado (não fechou ou acabou).
- servico: o que quer ou contratou, até 12 palavras.
- contato: pessoa, telefone/WhatsApp e e-mail que aparecerem, separados por " · ". Nunca senha nem dado bancário.
- origemLead: whatsapp, instagram, indicacao, prospeccao, site, outro, ou vazio se não der para saber.
- proximoContato: AAAA-MM-DD só se o material disser quando falar de novo; senão vazio.
- proximoPasso: a próxima ação do Samuel, curta.
- tipo: recorrente (mensal, contrato contínuo), pontual (projeto com fim) ou vazio.
- nota: o que importa saber, em até 5 linhas: contexto, dores, prazos, valores citados, país e cidade, Instagram e site.
- tarefas: só o que o material pede de concreto para o Samuel fazer, com prazo AAAA-MM-DD ou vazio.
Português do Brasil, sem travessão. Campo sem informação fica vazio.`;

export async function lerComIa({ texto, arquivos }) {
  if (!temChaveIa()) return { erro: 'A leitura pela IA precisa da OPENROUTER_API_KEY na stack.', semChave: true };
  const t = String(texto || '').trim();
  if (!t && !(arquivos || []).length) return { erro: 'Cole um texto ou escolha um arquivo.' };
  let anexos;
  try { anexos = prepararAnexos(arquivos || []); }
  catch (e) { return { erro: e.message }; }
  const partes = [];
  if (t) partes.push({ type: 'input_text', text: '--- Material colado ---\n' + t.slice(0, 60000) });
  partes.push(...anexos.partes);
  if (!partes.length) return { erro: 'Nenhum arquivo pôde ser lido. Use texto, imagem, PDF, DOCX ou ZIP.', lidos: anexos.lidos };
  let ia;
  try { ({ ia } = await pedirJsonIa(partes, { sistema: sistemaCadastro(new Date().toISOString().slice(0, 10)), esquema: ESQUEMA_CADASTRO, nome: 'ficha_do_cliente', tokens: 4000 })); }
  catch (e) { return { erro: 'A IA não respondeu: ' + e.message, lidos: anexos.lidos }; }
  const limpo = (v, max) => semTravessao(corte(v, max));
  return {
    lidos: anexos.lidos,
    ficha: {
      nome: limpo(ia.nome, 160), etapa: ETAPAS.some((e) => e.id === ia.etapa) ? ia.etapa : 'lead',
      servico: limpo(ia.servico, 300), contato: limpo(ia.contato, 300), origemLead: umDe(ORIGENS, ia.origemLead, ''),
      proximoContato: data(ia.proximoContato), proximoPasso: limpo(ia.proximoPasso, 500),
      tipo: ['recorrente', 'pontual'].includes(ia.tipo) ? ia.tipo : '', nota: semTravessao(String(ia.nota || '').slice(0, 4000)).trim(),
      tarefas: (Array.isArray(ia.tarefas) ? ia.tarefas : []).slice(0, 10).map((x) => ({ titulo: limpo(x.titulo, 300), prazo: data(x.prazo) })).filter((x) => x.titulo),
    },
  };
}
