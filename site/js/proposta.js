/* ============================================================
   Página de proposta: o pouco que ela tem além do main.js.

   Copiar dados de pagamento: um botão por valor e um para tudo.
   Sem clipboard (http, navegador velho), seleciona o texto para
   o Ctrl+C manual. Nunca falha em silêncio.
   ============================================================ */
(function () {
  'use strict';

  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto);
    }
    return new Promise(function (ok, erro) {
      var ta = document.createElement('textarea');
      ta.value = texto;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy') ? ok() : erro(); }
      catch (e) { erro(e); }
      ta.remove();
    });
  }

  function avisar(botao, texto) {
    var rot = botao.querySelector('span');
    var antes = rot ? rot.textContent : '';
    botao.classList.add('copiado');
    if (rot) rot.textContent = texto;
    clearTimeout(botao._t);
    botao._t = setTimeout(function () {
      botao.classList.remove('copiado');
      if (rot) rot.textContent = antes;
    }, 1600);
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-copiar], [data-copiar-tudo]');
    if (!b) return;
    e.preventDefault();

    var texto;
    if (b.hasAttribute('data-copiar-tudo')) {
      // "Rótulo: valor" por linha: cola limpo num e-mail ou no banco
      texto = Array.prototype.map.call(
        b.closest('.prop-campo').querySelectorAll('.prop-conta > div'),
        function (d) {
          return d.querySelector('dt').textContent.trim() + ': ' + d.querySelector('.prop-conta__valor').textContent.trim();
        }
      ).join('\n');
    } else {
      texto = b.getAttribute('data-copiar');
    }

    copiar(texto).then(
      function () { avisar(b, 'Copiado'); },
      function () { avisar(b, 'Selecione e copie'); }
    );
  });

  /* "Tenho dúvidas" abre a seção de perguntas, que nasce escondida.
     Na fase de captura, de propósito: o main.js já prendeu um clique
     nas âncoras que manda o Lenis rolar até o alvo, e se o alvo ainda
     estiver display:none nessa hora, ele rola para o lugar errado.
     Aqui a seção aparece antes; depois cada um faz a sua parte (o
     Lenis rola no desktop; no celular vale a âncora nativa). */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-duvidas]');
    if (!b) return;
    var faq = document.getElementById('duvidas');
    if (!faq) return;
    faq.classList.add('aberto');
    b.setAttribute('aria-expanded', 'true');
    var primeira = faq.querySelector('details');
    if (primeira && !faq.querySelector('details[open]')) primeira.open = true;
  }, true);

  /* Calculadora de retorno: o servidor já escreveu a conta do cenário
     inicial; aqui ela é refeita quando o cliente clica num cenário ou
     mexe nas réguas. Mexer na régua desmarca o cenário. */
  document.querySelectorAll('[data-roi]').forEach(function (raiz) {
    var inv = Number(raiz.getAttribute('data-investimento')) || 0;
    var moeda = raiz.getAttribute('data-moeda') || '$';
    var fmt = new Intl.NumberFormat(moeda === 'R$' ? 'pt-BR' : 'en-US', { maximumFractionDigits: 0 });
    var dinheiro = function (n) { return moeda + (moeda.length > 1 ? ' ' : '') + fmt.format(n); };
    var entrada = function (k) { return raiz.querySelector('[data-entrada="' + k + '"]'); };
    var saida = function (k, v) { var el = raiz.querySelector('[data-saida="' + k + '"]'); if (el) el.textContent = v; };

    function contar() {
      var t = Number(entrada('ticket').value) || 0;
      var q = Number(entrada('quantidade').value) || 0;
      var total = t * q;
      saida('ticket', dinheiro(t));
      saida('quantidade', String(q));
      saida('total', dinheiro(total));
      if (inv > 0 && t > 0) {
        var paga = Math.max(1, Math.ceil(inv / t));
        saida('paga', paga + (paga === 1 ? ' serviço' : ' serviços'));
        saida('vezes', Math.floor(total / inv) + 'x');
      }
    }

    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('[data-cenario]');
      if (!b) return;
      entrada('ticket').value = b.getAttribute('data-ticket');
      entrada('quantidade').value = b.getAttribute('data-quantidade');
      raiz.querySelectorAll('[data-cenario]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      contar();
    });
    raiz.addEventListener('input', function (e) {
      if (!e.target.matches('[data-entrada]')) return;
      raiz.querySelectorAll('[data-cenario]').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
      contar();
    });
  });
})();
