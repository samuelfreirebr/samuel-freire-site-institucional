/* ============================================================
   Casca do painel: o menu lateral fixo que toda tela de /admin
   (e a prospecção) carrega, no estilo do studio-admin. Cada página
   continua com a própria barra do topo (.topo); a casca só põe o
   menu ao lado e um botão para abrir o menu no celular.

   O menu é fixo e a página só ganha um recuo à esquerda: assim a
   rolagem continua sendo a da página, como as telas esperam.
   ============================================================ */

import { ico } from './icones.js';

const MENU = [
  { itens: [{ nome: 'Início', href: '/admin/', ico: 'inicio' }] },
  { titulo: 'CRM', itens: [
    { nome: 'Visão geral', href: '/admin/crm/', ico: 'painel' },
    { nome: 'Tarefas', href: '/admin/crm/#tarefas', ico: 'tarefas' },
    { nome: 'Calendário', href: '/admin/crm/#calendario', ico: 'calendario' },
    { nome: 'Leads', href: '/admin/crm/#leads', ico: 'leads' },
    { nome: 'Clientes', href: '/admin/crm/#clientes', ico: 'clientes', tambem: '/admin/crm/cliente/' },
  ] },
  { titulo: 'Trabalho', itens: [
    { nome: 'Propostas', href: '/admin/propostas/', ico: 'proposta' },
    { nome: 'Formulários', href: '/admin/formularios/', ico: 'formulario', tambem: '/admin/perguntas/' },
    { nome: 'Contratos', href: '/admin/contratos/', ico: 'contrato' },
    { nome: 'Faturas', href: '/admin/faturas/', ico: 'fatura' },
  ] },
  { titulo: 'Site e vendas', itens: [
    { nome: 'Editar site', href: '/admin/site/', ico: 'site' },
    { nome: 'Prospecção', href: '/google-prospection/', ico: 'prospeccao' },
    { nome: 'Cofre', href: '/admin/cofre/', ico: 'cofre' },
  ] },
];

// O item ativo é o do endereço atual; no CRM, a aba (#tarefas...) decide.
function ativo(item) {
  const [caminho, aba = ''] = item.href.split('#');
  if (item.tambem && location.pathname.startsWith(item.tambem)) return true;
  if (location.pathname !== caminho) return false;
  return caminho !== '/admin/crm/' || location.hash.slice(1) === aba;
}

function montar() {
  const nav = document.createElement('aside');
  nav.className = 'casca';
  nav.setAttribute('aria-label', 'Menu do painel');
  nav.innerHTML = `
    <div class="casca__cab">
      <a class="casca__marca" href="/admin/"><img src="/img/samuel-retrato.jpg" alt=""><span>Samuel <i>Freire</i></span></a>
      <button class="casca__recolher" type="button" data-recolher aria-label="Recolher o menu" title="Recolher o menu"></button>
    </div>
    <a class="casca__criar" href="/admin/crm/?nova=tarefa" title="Nova tarefa"><span>Nova tarefa</span></a>
    <button class="casca__item casca__sino" type="button" data-notif data-ico="sino" title="Notificações"><span>Notificações</span><b class="casca__n" hidden></b></button>
    <nav class="casca__nav">${MENU.map((g) => `
      <div class="casca__grupo">
        ${g.titulo ? `<p class="casca__titulo">${g.titulo}</p>` : ''}
        ${g.itens.map((i) => `<a class="casca__item" href="${i.href}" data-ico="${i.ico}" title="${i.nome}"><span>${i.nome}</span></a>`).join('')}
      </div>`).join('')}
    </nav>
    <div class="casca__pe">
      <a class="casca__item" href="/" target="_blank" rel="noopener" data-ico="externo" title="Ver o site"><span>Ver o site</span></a>
      <button class="casca__item" type="button" data-sair data-ico="sair" title="Sair"><span>Sair</span></button>
    </div>`;
  nav.querySelectorAll('[data-ico]').forEach((el) => el.prepend(ico(el.dataset.ico)));
  nav.querySelector('[data-recolher]').append(ico('recolher'));
  document.body.prepend(nav);
  document.body.classList.add('com-casca');

  // Recolher: o menu fica só com os ícones. A escolha fica guardada neste navegador.
  const recolhida = () => { try { return localStorage.getItem('casca-recolhida') === '1'; } catch (e) { return false; } };
  document.body.classList.toggle('casca-recolhida', recolhida());
  nav.querySelector('[data-recolher]').onclick = () => {
    const agora = !document.body.classList.contains('casca-recolhida');
    document.body.classList.toggle('casca-recolhida', agora);
    try { localStorage.setItem('casca-recolhida', agora ? '1' : '0'); } catch (e) {}
  };

  const marcar = () => nav.querySelectorAll('.casca__nav .casca__item').forEach((a) => {
    const item = MENU.flatMap((g) => g.itens).find((i) => i.href === a.getAttribute('href'));
    a.toggleAttribute('aria-current', ativo(item));
  });
  marcar();
  addEventListener('hashchange', marcar);

  nav.querySelector('[data-sair]').onclick = async () => {
    await fetch('/api/sair', { method: 'POST' });
    location.replace('/admin/entrar');
  };

  ligarNotificacoes(nav);

  // Celular: o menu sai da frente e abre pelo botão na barra do topo.
  const topo = document.querySelector('.topo');
  if (topo) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'casca__abrir';
    b.setAttribute('aria-label', 'Abrir o menu');
    b.append(ico('menu'));
    b.onclick = () => document.body.classList.toggle('casca-aberta');
    topo.prepend(b);
  }
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) document.body.classList.remove('casca-aberta'); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') document.body.classList.remove('casca-aberta'); });
}

/* ---------- Notificações ----------
   O sino conta o que aconteceu desde a última vez que foi aberto neste
   navegador: proposta vista, formulário aberto ou respondido. Ao abrir,
   mostra isso, as visitas do site e as tarefas atrasadas, de hoje e de
   amanhã (do painel e do ClickUp). */
const NOTIF_TXT = {
  'proposta-aberta': (n) => `${n} abriu a proposta`,
  'proposta-voltou': (n) => `${n} voltou a ver a proposta`,
  'formulario-aberta': (n) => `${n} abriu o formulário`,
  'formulario-voltou': (n) => `${n} voltou ao formulário`,
  'formulario-respondido': (n) => `${n} respondeu o formulário`,
};
const lerVisto = () => { try { return localStorage.getItem('notif-visto') || ''; } catch (e) { return ''; } };
const escH = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const diaLocal = (soma = 0) => new Date(Date.now() + soma * 864e5).toLocaleDateString('en-CA');
function haQuanto(iso) {
  const min = Math.round((Date.now() - new Date(iso)) / 60000);
  if (min < 60) return min <= 1 ? 'agora' : `há ${min} min`;
  if (min < 1440) return `há ${Math.round(min / 60)} h`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}
const buscar = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);

async function ligarNotificacoes(nav) {
  const botao = nav.querySelector('[data-notif]'), n = botao.querySelector('.casca__n');
  const contar = (d) => {
    const visto = lerVisto(), novos = (d?.eventos || []).filter((e) => e.quando > visto).length;
    n.hidden = !novos; n.textContent = novos > 9 ? '9+' : novos;
  };
  buscar('/api/novidades').then(contar);

  const jan = document.createElement('dialog');
  jan.className = 'notif';
  jan.setAttribute('aria-label', 'Notificações');
  document.body.append(jan);

  botao.onclick = async () => {
    jan.innerHTML = '<header class="modal__topo"><b>Notificações</b><button class="mini" type="button" data-fechar>Fechar</button></header><div class="modal__corpo"><p class="vazio">Carregando…</p></div>';
    jan.querySelector('[data-fechar]').onclick = () => jan.close();
    jan.showModal();
    const [nov, crm, cu] = await Promise.all([buscar('/api/novidades'), buscar('/api/crm'), buscar('/api/clickup')]);
    const visto = lerVisto();
    const hoje = diaLocal(), amanha = diaLocal(1);
    const tarefas = [
      ...(crm?.clientes || []).filter((c) => c.etapa !== 'encerrado').flatMap((c) => (c.atividades || [])
        .filter((t) => t.estado !== 'feita' && t.prazo).map((t) => ({ titulo: t.titulo, prazo: t.prazo, quem: c.interno ? 'Empresa' : c.nome, link: c.interno ? '/admin/crm/#tarefas' : `/admin/crm/cliente/#${c.id}&tarefas` }))),
      ...(cu?.tarefas || []).filter((t) => t.estado !== 'feita' && t.prazo).map((t) => ({ titulo: t.titulo, prazo: t.prazo, quem: `${t.cliente} (ClickUp)`, link: t.url })),
    ].filter((t) => t.prazo <= amanha).sort((a, b) => a.prazo.localeCompare(b.prazo));
    const grupo = (nome, lista, classe = '') => lista.length ? `<section class="notif__grupo"><h3 class="${classe}">${nome} <span>${lista.length}</span></h3><ul>${lista.map((t) => `<li><a href="${escH(t.link)}"${t.link.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}><b>${escH(t.titulo)}</b><small>${escH(t.quem)}</small></a></li>`).join('')}</ul></section>` : '';
    const eventos = (nov?.eventos || []).slice(0, 30);
    const v = nov?.visitas;
    jan.querySelector('.modal__corpo').innerHTML = `
      ${v ? `<a class="notif__visitas" href="/admin/crm/"><b>${v.hoje}</b><span>visita${v.hoje === 1 ? '' : 's'} no site hoje</span><small>${v.semana} nos últimos 7 dias</small></a>` : ''}
      ${grupo('Atrasadas', tarefas.filter((t) => t.prazo < hoje), 'atraso')}
      ${grupo('Para hoje', tarefas.filter((t) => t.prazo === hoje))}
      ${grupo('Para amanhã', tarefas.filter((t) => t.prazo === amanha))}
      <section class="notif__grupo"><h3>Propostas e formulários</h3>
        ${eventos.length ? `<ul>${eventos.map((e) => `<li${e.quando > visto ? ' class="novo"' : ''}><a href="${escH(e.link)}"><b>${escH((NOTIF_TXT[e.tipo] || ((x) => x))(e.titulo))}</b><small>${haQuanto(e.quando)}</small></a></li>`).join('')}</ul>`
          : '<p class="vazio">Nada ainda. Quando um cliente abrir uma proposta ou responder um formulário, aparece aqui.</p>'}
      </section>`;
    try { localStorage.setItem('notif-visto', new Date().toISOString()); } catch (e) {}
    contar(nov);
  };
}

/* Clicar fora de uma janela aberta (no fundo escuro) fecha a janela.
   Vale para todo <dialog> do painel: prévia lateral, tarefa, cadastro. */
document.addEventListener('click', (e) => {
  const d = e.target;
  if (!(d instanceof HTMLDialogElement) || !d.open) return;
  const r = d.getBoundingClientRect();
  const fora = e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  if (fora) d.close();
});

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
