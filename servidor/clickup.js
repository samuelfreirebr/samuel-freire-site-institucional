/* ============================================================
   ClickUp: lê as tarefas abertas de cada área e entrega ao painel,
   já com o nome do cliente do CRM. Só leitura: o painel mostra e
   leva ao ClickUp; quem muda status é o próprio ClickUp.

   Cada área usa a chave pessoal da conta que a enxerga (variáveis
   CLICKUP_TOKEN_EDA e CLICKUP_TOKEN_ETRIA no stack).
   ============================================================ */

/* cliente: nome igual ao do CRM. so: id do Samuel quando a área tem
   muita gente e só interessam as tarefas dele. fica: filtro extra.
   Casa SW (pedido do Samuel em 29/10/2026): só "em aberto" com prazo de
   novembro em diante; o que está esperando aprovação do médico fica fora,
   e Reels nunca entra. */
const AREAS = [
  { cliente: 'SW Surgical World', chave: 'CLICKUP_TOKEN_EDA', time: '90171444669', so: null,
    fica: (t) => t.status === 'em aberto' && t.prazo >= '2026-11-01' && !/^\s*reels?\b/i.test(t.titulo) },
  { cliente: 'Etria', chave: 'CLICKUP_TOKEN_ETRIA', time: '90133035284', so: '112137541' },
];

const VALIDADE = 10 * 60 * 1000; // relê o ClickUp no máximo a cada 10 minutos
let guardado = { em: 0, tarefas: [], erros: [] };

/* Status do ClickUp (livre em cada área) para os estados do painel.
   "Aprovado internamente" ainda espera o cliente: fica em aguardando. */
function estado(status) {
  const s = status.toLowerCase().trim();
  if (/^(aprovado|finalizado|conclu[ií]do|done|complete)$/.test(s)) return 'feita';
  if (/aprova|revis|ajuste|aguard/.test(s)) return 'aguardando';
  if (/andamento|produ|execu|design|edi|fazendo|progress/.test(s)) return 'andamento';
  return 'afazer';
}

const dia = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 10) : '');

const api = (a, caminho, extra = {}) => fetch(`https://api.clickup.com/api/v2/${caminho}`, {
  ...extra, headers: { Authorization: process.env[a.chave], 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
});

/* Status de cada lista (cada lista do ClickUp tem os seus). "feito" é o
   primeiro do tipo done, ou o closed quando a lista não tem done. */
async function statusDaLista(a, lista) {
  const r = await api(a, `list/${lista}`);
  if (!r.ok) return { opcoes: [], feito: '' };
  const st = ((await r.json()).statuses || []).sort((x, y) => x.orderindex - y.orderindex);
  const feito = st.find((x) => x.type === 'done') || st.find((x) => x.type === 'closed');
  return { opcoes: st.map((x) => x.status), feito: feito?.status || '' };
}

async function daArea(a) {
  if (!process.env[a.chave]) return [];
  const lidas = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const filtro = a.so ? `&assignees[]=${a.so}` : '';
    const r = await api(a, `team/${a.time}/task?page=${pagina}&subtasks=true${filtro}`);
    if (!r.ok) throw new Error(`${a.cliente}: ClickUp respondeu ${r.status}`);
    const { tasks = [], last_page: ultima = true } = await r.json();
    lidas.push(...tasks);
    if (ultima || !tasks.length) break;
  }
  const tarefas = lidas.map((t) => ({
    id: t.id,
    titulo: t.name,
    status: t.status.status,
    estado: estado(t.status.status),
    prazo: dia(t.due_date),
    lista: t.list?.name || '',
    listaId: t.list?.id || '',
    url: t.url,
    cliente: a.cliente,
  })).filter(a.fica || Boolean);
  const listas = Object.fromEntries(await Promise.all([...new Set(tarefas.map((t) => t.listaId))]
    .map(async (id) => [id, await statusDaLista(a, id)])));
  return tarefas.map((t) => ({ ...t, ...listas[t.listaId] }));
}

export const ligado = () => AREAS.some((a) => process.env[a.chave]);

export async function tarefas({ renovar = false } = {}) {
  if (!renovar && Date.now() - guardado.em < VALIDADE) return guardado;
  const lidas = await Promise.allSettled(AREAS.map(daArea));
  guardado = {
    em: Date.now(),
    tarefas: lidas.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])),
    erros: lidas.filter((r) => r.status === 'rejected').map((r) => r.reason.message),
  };
  return guardado;
}

/* Troca o status de uma tarefa no próprio ClickUp. Só aceita tarefa que o
   painel já leu e status que existe na lista dela. */
export async function mudarStatus(id, status) {
  const t = guardado.tarefas.find((x) => x.id === id);
  if (!t) throw new Error('Tarefa do ClickUp não encontrada. Recarregue a página.');
  if (!t.opcoes.includes(status)) throw new Error('Esse status não existe nesta lista do ClickUp.');
  const a = AREAS.find((x) => x.cliente === t.cliente);
  const r = await api(a, `task/${id}`, { method: 'PUT', body: JSON.stringify({ status }) });
  if (!r.ok) throw new Error(`O ClickUp não aceitou a mudança (${r.status}).`);
  Object.assign(t, { status, estado: estado(status) });
  return t;
}
