// node servidor/lembretes.teste.js : confere a lista do dia dos lembretes
import assert from 'node:assert/strict';
process.env.PASTA_DADOS ||= '/tmp';
const { juntar, montar } = await import('./lembretes.js');

const hoje = '2026-11-20';
const g = juntar({
  clientes: [
    { nome: 'Cliente A', etapa: 'followup', proximoContato: '2026-11-19', proximoPasso: 'mandar a proposta revisada',
      atividades: [
        { titulo: 'Atrasada', estado: 'afazer', prazo: '2026-11-18' },
        { titulo: 'De hoje', estado: 'andamento', prazo: hoje },
        { titulo: 'Feita', estado: 'feita', prazo: hoje },
        { titulo: 'Urgente sem data', estado: 'afazer', prioridade: 'urgente' },
        { titulo: 'Depois de amanhã', estado: 'afazer', prazo: '2026-11-22' },
        { titulo: 'Longe', estado: 'afazer', prazo: '2026-12-30' },
        { titulo: 'Esperando o cliente', estado: 'aguardando', prazo: '2026-11-15' },
      ],
      projetos: [{ nome: 'Site', estado: 'andamento', prazo: '2026-11-21' }] },
    { nome: 'Empresa', interno: true, atividades: [{ titulo: 'Interna de hoje', estado: 'afazer', prazo: hoje }] },
  ],
  clickup: [{ titulo: 'Card ClickUp', cliente: 'Etria', estado: 'afazer', prazo: hoje }],
  faturas: [{ codigo: 'FT-1', cliente: 'Cliente B', vencimento: '2026-11-10', paga: false }, { codigo: 'FT-2', cliente: 'C', vencimento: '2026-11-10', paga: true }],
}, hoje);

assert.deepEqual(g.atrasadas.map((i) => i.titulo), ['Fatura FT-1 de Cliente B', 'Atrasada', 'Falar com Cliente A: mandar a proposta revisada']);
assert.deepEqual(g.hoje.map((i) => i.titulo), ['De hoje', 'Interna de hoje', 'Card ClickUp']);
assert.deepEqual(g.urgentes.map((i) => i.titulo), ['Urgente sem data']);
assert.deepEqual(g.proximos.map((i) => i.titulo), ['Prazo do projeto Site', 'Depois de amanhã']);
assert.deepEqual(g.aguardando.map((i) => i.titulo), ['Esperando o cliente']);

const manha = montar(g, true);
assert.match(manha, /^ATRASADAS \(3\)/);
assert.ok(manha.includes('• De hoje (Cliente A)'));
assert.ok(manha.includes('• Interna de hoje\n'), 'tarefa interna sem nome de cliente');
const tarde = montar(g, false);
assert.ok(tarde.startsWith('AINDA PARA HOJE (3)') && !tarde.includes('PRÓXIMOS'));
assert.equal(montar(juntar({}, hoje), true), '', 'sem nada, sem aviso');
console.log('lembretes ok');
