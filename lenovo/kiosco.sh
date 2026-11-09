#!/usr/bin/env bash
# ======================================================
# Abre la carita a pantalla completa.
#   bash lenovo/kiosco.sh             -> abrir ahora
#   bash lenovo/kiosco.sh --instalar  -> abrir solo al iniciar sesión
# ======================================================
LENOVO="$(cd "$(dirname "$0")" && pwd)"
URL="$(grep -E '^CARA_URL=' "$LENOVO/config.env" 2>/dev/null | cut -d= -f2-)"
URL="${URL:-https://tu-proyecto.vercel.app/cara}"

if [ "$1" = "--instalar" ]; then
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/robot-cara.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Robot cara
Exec=bash $LENOVO/kiosco.sh
X-GNOME-Autostart-enabled=true
DESK
  echo "Autoarranque instalado: abrirá $URL"
  exit 0
fi

# Espera a tener internet
for i in $(seq 1 60); do
  curl -s -o /dev/null --max-time 3 "$URL" && break
  sleep 2
done

# Que la pantalla no se apague
xset s off -dpms 2>/dev/null || true

for nav in chromium chromium-browser google-chrome; do
  if command -v "$nav" >/dev/null; then
    exec "$nav" --kiosk --noerrdialogs --disable-infobars \
      --check-for-update-interval=31536000 "$URL"
  fi
done
exec firefox --kiosk "$URL"
