/* ============================================================
   ClickUp: lê as tarefas abertas de cada área e entrega ao painel,
   já com o nome do cliente do CRM. Só leitura: o painel mostra e
   leva ao ClickUp; quem muda status é o próprio ClickUp.

   Cada área usa a chave pessoal da conta que a enxerga (variáveis
   CLICKUP_TOKEN_EDA e CLICKUP_TOKEN_ETRIA no stack).
   ============================================================ */

/* cliente: nome igual ao do CRM. so: id do Samuel quando a área tem
   muita gente e só interessam as tarefas dele. */
const AREAS = [
  { cliente: 'SW Surgical World', chave: 'CLICKUP_TOKEN_EDA', time: '90171444669', so: null },
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

async function daArea(a) {
  const chave = process.env[a.chave];
  if (!chave) return [];
  const lidas = [];
  for (let pagina = 0; pagina < 10; pagina++) {
    const filtro = a.so ? `&assignees[]=${a.so}` : '';
    const r = await fetch(`https://api.clickup.com/api/v2/team/${a.time}/task?page=${pagina}&subtasks=true${filtro}`, {
      headers: { Authorization: chave }, signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`${a.cliente}: ClickUp respondeu ${r.status}`);
    const { tasks = [], last_page: ultima = true } = await r.json();
    lidas.push(...tasks);
    if (ultima || !tasks.length) break;
  }
  return lidas.map((t) => ({
    id: t.id,
    titulo: t.name,
    status: t.status.status,
    estado: estado(t.status.status),
    prazo: dia(t.due_date),
    lista: t.list?.name || '',
    url: t.url,
    cliente: a.cliente,
  }));
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
