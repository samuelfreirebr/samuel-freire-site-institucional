/* ============================================================
   Relatório quinzenal das métricas: dia 15 e último dia do mês.

   No dia do ciclo (horário de Brasília), uma vez só:
   1. para cada site medido, pega os últimos 15 dias e pede à IA uma
      mensagem curta ao cliente, com análise e recomendação;
   2. cria no CRM (tarefas da empresa) a tarefa "Enviar relatórios de
      métricas", com um item por cliente;
   3. avisa no sino do painel.
   A mensagem de cada site aparece no relatório dele (Métricas dos
   clientes), com botão de copiar. Quem envia é o Samuel.
   ============================================================ */

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { RAIZ_DADOS } from './dados.js';
import * as metricas from './metricas.js';
import * as crm from './crm.js';
import * as novidades from './novidades.js';
import { pedirJsonIa, temChaveIa, semTravessao } from './proposta-ia.js';

const ARQ = path.join(RAIZ_DADOS, 'metricas', 'relatorios.json');   // { ciclo, mensagens: { id: {...} } }
const hojeBr = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

export function ehDiaDeCiclo(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return d === 15 || d === new Date(Date.UTC(a, m, 0)).getUTCDate();
}

async function ler() {
  try { return JSON.parse(await fs.readFile(ARQ, 'utf8')); } catch { return { ciclo: '', mensagens: {} }; }
}
async function gravar(d) {
  await fs.mkdir(path.dirname(ARQ), { recursive: true });
  await fs.writeFile(ARQ + '.tmp', JSON.stringify(d, null, 1), 'utf8');
  await fs.rename(ARQ + '.tmp', ARQ);
}

export async function mensagemDe(id) { return (await ler()).mensagens[id] || null; }

const SISTEMA = `Você escreve, em português do Brasil, a mensagem de WhatsApp que o Samuel Freire manda a cada 15 dias para um cliente dele junto com o relatório das métricas do site.
O cliente é dono de um negócio local nos EUA (pisos, construção, joias etc.) e não é técnico.
Regras:
- Curta: até 8 linhas. Tom de conversa, próximo e direto, sem cara de anúncio. Sem travessão. Sem emoji em excesso (no máximo 1).
- Comece com uma saudação simples usando o nome do negócio.
- Diga os números que importam: visitas, pessoas, contatos (ligações, WhatsApp, e-mail, formulários enviados) e a comparação com os 15 dias anteriores quando houver.
- Interprete: o que os números mostram de bom ou de ruim.
- Termine com 1 ou 2 recomendações práticas e concretas para os próximos 15 dias (ex.: postar o link do site no Instagram, pedir avaliações no Google, mudar a chamada do formulário, divulgar o serviço da página mais vista).
- Nunca invente número. Se as visitas forem zero, diga que o painel ainda está começando a medir e não tire conclusão.
- Não mencione IA nem "relatório automático".
- Não liste canal com zero. Não sugira ferramenta de medição (GA4, Tag Manager etc.): a medição já é do painel.
Devolva JSON com "mensagem" (o texto pronto para colar) e "analise" (2 a 3 frases só para o Samuel, sobre o que fazer com esse cliente).`;

const ESQUEMA = {
  type: 'object', additionalProperties: false, required: ['mensagem', 'analise'],
  properties: { mensagem: { type: 'string' }, analise: { type: 'string' } },
};

function numeros(r) {
  const a = r.atual, b = r.anterior;
  return {
    negocio: r.site.nome, dias: r.dias,
    atual: { visitas: a.visitas, pessoas: a.visitantes, celularPct: a.visitas ? Math.round(a.celular / a.visitas * 100) : 0, tempoMedioSeg: a.tempoMedio,
      ligacoes: a.ligar, whatsapp: a.whatsapp, email: a.email, formulariosComecados: a.formInicio, formulariosEnviados: a.leads, contatos: a.contatos,
      paginasMaisVistas: a.paginas.slice(0, 4), origens: a.origens.slice(0, 4) },
    anterior: { visitas: b.visitas, contatos: b.contatos, formulariosEnviados: b.leads },
  };
}

// Sem chave da IA (ou se ela falhar), sai uma mensagem simples com os números.
function mensagemSimples(r) {
  const a = r.atual, b = r.anterior;
  if (!a.visitas) return `Olá, ${r.site.nome}! O painel de métricas do seu site está começando a medir agora. No próximo relatório já trago os primeiros números.`;
  const comp = b.visitas ? ` (nos 15 dias anteriores foram ${b.visitas})` : '';
  return `Olá, ${r.site.nome}! Segue o relatório do seu site dos últimos ${r.dias} dias.\n\n${a.visitas} visitas de ${a.visitantes} pessoas${comp}, e ${a.contatos} contatos pelo site (ligações, WhatsApp, e-mail e formulário).\n\nQualquer dúvida, me chama.`;
}

async function gerarUma(r) {
  if (temChaveIa() && r.atual.visitas) {
    try {
      const { ia } = await pedirJsonIa([{ type: 'input_text', text: JSON.stringify(numeros(r)) }], { sistema: SISTEMA, esquema: ESQUEMA, nome: 'mensagem_relatorio', tokens: 1200 });
      return { mensagem: semTravessao(ia.mensagem), analise: semTravessao(ia.analise), ia: true };
    } catch (e) { console.error('relatorios: IA falhou para', r.site.id, e.message); }
  }
  return { mensagem: mensagemSimples(r), analise: '', ia: false };
}

let rodando = false;
export async function rodarCiclo({ forcar = false } = {}) {
  if (rodando) return { ok: false, motivo: 'já está rodando' };
  const dia = hojeBr(), est = await ler();
  if (!forcar && (!ehDiaDeCiclo(dia) || est.ciclo === dia)) return { ok: false, motivo: 'não é dia de ciclo' };
  rodando = true;
  try {
    const sites = await metricas.listarSites(), mensagens = { ...est.mensagens };
    for (const s of sites) {
      const r = await metricas.resumo(s.id, 15);
      mensagens[s.id] = { ...(await gerarUma(r)), dia, visitas: r.atual.visitas, contatos: r.atual.contatos };
    }
    await gravar({ ciclo: dia, mensagens });
    await criarTarefa(dia, sites, mensagens);
    await novidades.registrar('relatorios', dia, `Relatórios de métricas prontos para enviar (${sites.length} clientes)`, '/admin/metricas/');
    return { ok: true, dia, sites: sites.length };
  } finally { rodando = false; }
}

async function criarTarefa(dia, sites, mensagens) {
  const interno = (await crm.listar()).find((c) => c.interno);
  if (!interno) return;
  const br = dia.split('-').reverse().slice(0, 2).join('/');
  const titulo = `Enviar relatórios de métricas (${br})`;
  if ((interno.atividades || []).some((a) => a.titulo === titulo)) return;   // ciclo forçado duas vezes no mesmo dia
  const nova = {
    titulo, estado: 'afazer', prioridade: 'alta', prazo: dia, origem: 'claude',
    descricao: 'Para cada cliente: abrir Métricas dos clientes, escolher o site, clicar em Exportar PDF e mandar no WhatsApp com a mensagem pronta (botão Copiar mensagem, no próprio relatório).\nhttps://links.samuelfreire.com.br/admin/metricas/',
    checklist: sites.map((s) => ({ texto: `${s.nome}: ${mensagens[s.id].visitas} visitas, ${mensagens[s.id].contatos} contatos`, feito: false })),
  };
  await crm.salvar({ id: interno.id, atividades: [nova, ...(interno.atividades || [])] }, 'claude');
}

// Confere de hora em hora; roda uma vez no dia do ciclo, a partir das 9h de Brasília.
export function ligar() {
  const tentar = () => {
    const hora = Number(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo', hour: 'numeric', hour12: false }));
    if (hora >= 9) rodarCiclo().catch((e) => console.error('relatorios:', e.message));
  };
  setTimeout(tentar, 30e3);
  setInterval(tentar, 3600e3);
}
