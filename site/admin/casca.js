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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar); else montar();
