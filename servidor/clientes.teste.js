// node servidor/clientes.teste.js : confere senha, sessão e lead do painel do cliente
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
process.env.PASTA_DADOS = mkdtempSync(path.join(tmpdir(), 'clientes-'));
process.env.SENHA_PAINEL = 'teste';
const metricas = await import('./metricas.js');
const c = await import('./clientes.js');

await metricas.salvarSite({ id: 'site-a', nome: 'Site A', dominios: 'sitea.com' });
await assert.rejects(c.salvarAcesso('site-a', { email: 'a@a.com' }), /senha/);
await c.salvarAcesso('site-a', { email: 'A@A.com', senha: 'segredo1' });
assert.equal(await c.conferir('a@a.com', 'errada'), null);
const a = await c.conferir('a@a.com', 'segredo1');
assert.equal(a.site, 'site-a');
assert.ok(!JSON.stringify(await c.listarAcessos()).includes('segredo1'), 'senha nunca em texto');

const req = (cookie) => ({ headers: { cookie } });
const token = c.criarSessao(a);
assert.equal((await c.sessao(req('cliente=' + token))).site, 'site-a');
assert.equal(await c.sessao(req('cliente=' + token.slice(0, -2) + 'xx')), null, 'assinatura adulterada');
await c.salvarAcesso('site-a', { email: 'a@a.com', senha: 'segredo2' });
assert.equal(await c.sessao(req('cliente=' + token)), null, 'trocar a senha derruba a sessão');

const pedido = (origin) => ({ headers: { origin }, socket: { remoteAddress: '1.1.1.1' } });
assert.match(await c.registrarLead(pedido('https://outro.com'), JSON.stringify({ s: 'site-a', nome: 'X', telefone: '1' })), /não cadastrado/);
assert.equal(await c.registrarLead(pedido('https://www.sitea.com'), JSON.stringify({ s: 'site-a', nome: 'Ana', telefone: '2035550100' })), '');
assert.equal(await c.registrarLead(pedido('https://sitea.com'), JSON.stringify({ s: 'site-a', nome: 'Robô', telefone: '1', empresa: 'x' })), '');
assert.deepEqual((await c.listarLeads('site-a')).map((l) => l.nome), ['Ana'], 'isca não grava');
const [ana] = await c.listarLeads('site-a');
assert.equal(await c.apagarLeads('site-a', ['nao-existe']), 0);
assert.equal(await c.apagarLeads('site-a', [ana.id]), 1);
assert.deepEqual(await c.listarLeads('site-a'), [], 'lead apagado some');
assert.equal((await metricas.resumo('site-a', 30)).atual.leads, 0, 'e sai da contagem');
// Avisos: aparelho do cliente fica no site dele, separado dos do Samuel.
const push = await import('./push.js');
const sub = { endpoint: 'https://push.invalido/1', keys: { p256dh: 'x', auth: 'y' } };
assert.equal(await push.inscrever(sub, 'site-a'), 1);
assert.equal((await push.avisar({ titulo: 't' })).aparelhos, 0, 'Samuel não recebe o aparelho do cliente');
assert.equal(await push.sair(sub.endpoint, 'site-a'), 0);
console.log('clientes ok');
process.exit(0);
