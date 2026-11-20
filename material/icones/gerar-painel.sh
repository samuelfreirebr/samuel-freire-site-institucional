#!/bin/sh
# Gera os ícones do app Painel (/admin na tela de início) em site/img/painel-*.png.
# Precisa do Google Chrome instalado. Rode na raiz do projeto:
#   sh material/icones/gerar-painel.sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$(cd "$AQUI/../.." && pwd)"
"$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=512,512 --screenshot="$RAIZ/site/img/painel-512.png" "file://$AQUI/painel.svg" >/dev/null 2>&1
for t in 192 180; do sips -z $t $t "$RAIZ/site/img/painel-512.png" --out "$RAIZ/site/img/painel-$t.png" >/dev/null; done
ls -l "$RAIZ"/site/img/painel-*.png
