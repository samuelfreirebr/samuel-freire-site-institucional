/* ============================================================
   Ícones dos botões do painel: traço fino de 1.5, 16px, na cor do
   texto. Poucos e só onde ajudam a achar o botão (copiar, abrir,
   apagar, salvar), não em todos. Uso: ico('copiar').
   ============================================================ */

const DESENHOS = {
  copiar: 'M6 3h7v8H6z M3 6v7h7',
  abrir: 'M9 3h4v4 M13 3 7 9 M11 9.5V13H3V5h3.5',
  editar: 'M3 13l.8-3L11 2.8 13.2 5 6 12.2z M9.8 4 12 6.2',
  respostas: 'M2 9.5 4 3h8l2 6.5V13H2z M2 9.5h3.5l1 1.5h3l1-1.5H14',
  apagar: 'M3 5h10 M6 5V3h4v2 M4.5 5l.6 8h5.8l.6-8',
  mais: 'M8 3v10 M3 8h10',
  modelo: 'M2.5 3h11v10h-11z M2.5 7h11 M7 7v6',
  ia: 'M8 2l1.4 4.1L13.5 7.5 9.4 9 8 13 6.6 9 2.5 7.5 6.6 6.1z',
  salvar: 'M3 8.5l3.5 3.5L13 4.5',
  elo: 'M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6 M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6',
  enviar: 'M8 11V3 M5 6l3-3 3 3 M3 13h10',
  voltar: 'M13 8H3 M7 4 3 8l4 4',
  formulario: 'M4 2h8v12H4z M6.2 5.5h3.6 M6.2 8h3.6 M6.2 10.5h2',
  cofre: 'M2.5 3.5h11v9h-11z M8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z M4.5 12.5V14 M11.5 12.5V14',
  fixar: 'M6 2.5h4 M7 2.5v4L4.5 9h7L9 6.5v-4 M8 9v4.5',
  nota: 'M3.5 2h6l3 3v9h-9z M9.5 2v3h3 M5.5 8h5 M5.5 10.5h3.5',
  busca: 'M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10z M14 14l-3.5-3.5',
  olho: 'M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z M8 9.7a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
  // Menu lateral (casca.js)
  inicio: 'M2.5 7 8 2.5 13.5 7v6.5h-11z M6.5 13.5v-4h3v4',
  painel: 'M2.5 2.5h5v6h-5z M8.5 2.5h5v3h-5z M8.5 7.5h5v6h-5z M2.5 10.5h5v3h-5z',
  tarefas: 'M2.5 4l1.2 1.2L6 3 M2.5 8.5l1.2 1.2L6 7.5 M2.5 13l1.2 1.2L6 12 M8.5 4h5 M8.5 8.5h5 M8.5 13h5',
  calendario: 'M2.5 3.5h11v10h-11z M2.5 6.5h11 M5.5 2v3 M10.5 2v3',
  leads: 'M2.5 3h11l-4.2 5.2v4.8l-2.6-1.5V8.2z',
  clientes: 'M6 7.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M1.5 13.5c.4-2.5 2.2-4 4.5-4s4.1 1.5 4.5 4 M10.5 2.7a2.4 2.4 0 0 1 0 4.6 M12.5 9.8c1 .6 1.7 1.9 2 3.7',
  proposta: 'M4 2h5.5L12 4.5V14H4z M9.5 2v2.5H12 M6 8h4 M6 10.5h4',
  contrato: 'M3.5 2h7l2 2v10h-9z M5.5 6h5 M5.5 8.5h5 M5.5 12l1.5-1.5 1 1 2-2',
  fatura: 'M3.5 2h9v12l-1.5-1-1.5 1-1.5-1-1.5 1-1.5-1-1.5 1z M6 5.5h4 M6 8h4',
  site: 'M2 3h12v10H2z M2 5.5h12 M4 4.2h.01 M5.6 4.2h.01',
  prospeccao: 'M8 14s4.5-4.2 4.5-7.5a4.5 4.5 0 0 0-9 0C3.5 9.8 8 14 8 14z M8 8.2a1.7 1.7 0 1 0 0-3.4 1.7 1.7 0 0 0 0 3.4z',
  sair: 'M6 13.5H3V2.5h3 M10 11l3-3-3-3 M13 8H6',
  menu: 'M2.5 4h11 M2.5 8h11 M2.5 12h11',
  recolher: 'M2.5 2.5h11v11h-11z M6 2.5v11 M10.5 6 8.5 8l2 2',
  externo: 'M9 3h4v4 M13 3 7 9 M11 9.5V13H3V5h3.5',
};

export function ico(nome) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('class', 'ico');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', DESENHOS[nome] || DESENHOS.mais);
  svg.append(p);
  return svg;
}
