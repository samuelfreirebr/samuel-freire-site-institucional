# Design system: site Samuel Freire (links.samuelfreire.com.br)

> Singularidades deste site que estavam escritas como "exemplo de identidade" nas arquiteturas de site (Dist v1 a v3 e site com painel admin) e foram separadas em 22/10/2026. A construção segue `03-RECURSOS/ARQUITETURAS/SITE/site-universal.md` (variante B, com painel).
>
> Estas escolhas são **singulares deste projeto** e valem aqui mesmo quando o padrão geral faria diferente (decisão do Matheus, 22/10/2026).

## Identidade

- **Cores:** destaque `--brand: #FF4F18` (laranja), tinta `#141517`, branco, cinza `#F2F4F7`, secundário `#5B6470`.
- **Contraste conferido:** `#9AA3AF` dá 2,55:1 sobre branco e reprova no AA. Texto secundário usa `#5B6470` (6:1).
- **Tipografia:** Manrope 300 a 800. Display em 800 com tracking de −0.035 a −0.055em.
- **Rótulo (eyebrow):** 600, caixa alta, tracking 0.14 a 0.22em, com um ponto laranja antes.
- **Métrica:** numeral grande com régua de 2 px acima.
- **Fotos** com raio de 5 px.
- **Detalhes gráficos** só pequenos: quadrado de 9 px, ponto de 5 px, traço curto.
- **Botões:** texto à esquerda, seta dentro de um círculo à direita; no hover o botão inverte e a seta gira para a direita.
- **Superfícies:** sem gradiente, sem sombra, sem card flutuante. Separação por linha fina (`--hair`, 1 px). A única "sombra" é `inset` de 1 px na borda do botão vazado.
- **Tom:** editorial, suíço, mínimo.

## Estrutura própria

- Duas versões no mesmo app: `/` (BR) e `/global`, dois `index.html` com `data-versao` no `<html>`, canônica para a raiz e sem `noindex`. Desvio automático por país só com a Cloudflare em modo proxy (`CF-IPCountry`); por padrão não há desvio.
- Folhas de versão: `br.css` e `global.css`, carregadas depois de `site.css`.
- Módulo de propostas no painel (`/propostas/<id>`, `proposta.css`, `proposta-html.js`).
- Usuário padrão do painel: `USUARIO_PAINEL=samuel`. Opcional: `ROTEAR_POR_PAIS`.
- Cópia estática de teste publicada em `samuelfreire.com.br/pagina-teste`.
