#!/usr/bin/env bash
# ======================================================
# Instalación en la Lenovo del robot (Ubuntu / Debian)
# Necesita internet. Ejecutar UNA vez:
#   cd ~/robot-iot && sudo bash lenovo/instalar.sh
# ======================================================
set -e

LENOVO="$(cd "$(dirname "$0")" && pwd)"
USUARIO="${SUDO_USER:-$USER}"

if [ ! -f "$LENOVO/config.env" ]; then
  echo "ERROR: falta lenovo/config.env"
  echo "Haz primero:  cp lenovo/config.env.example lenovo/config.env  y llénalo."
  exit 1
fi

echo "==> 1/4 Python y herramientas"
apt-get update
apt-get install -y python3 python3-venv python3-pip curl

# brltty (lector braille) "secuestra" los adaptadores USB CH340 de la ESP32
apt-get remove -y brltty 2>/dev/null || true

# Permiso para usar el puerto USB sin sudo
usermod -aG dialout "$USUARIO"

echo "==> 2/4 Entorno de Python con paho-mqtt y pyserial"
sudo -u "$USUARIO" python3 -m venv "$LENOVO/.venv"
sudo -u "$USUARIO" "$LENOVO/.venv/bin/pip" install -r "$LENOVO/requirements.txt"

echo "==> 3/4 Servicio: el puente arranca solo al prender la Lenovo"
cat > /etc/systemd/system/robot-puente.service <<UNIT
[Unit]
Description=Puente ESP32 <-> broker MQTT (robot)
After=network-online.target
Wants=network-online.target

[Service]
User=$USUARIO
WorkingDirectory=$LENOVO
ExecStart=$LENOVO/.venv/bin/python -u $LENOVO/puente.py
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable robot-puente
systemctl restart robot-puente

echo "==> 4/4 Carita en pantalla completa al iniciar sesión"
sudo -u "$USUARIO" bash "$LENOVO/kiosco.sh" --instalar

echo
echo "LISTO."
echo "  Ver si el puente funciona:  journalctl -u robot-puente -f"
echo "  Reinicia la Lenovo para que todo arranque solo:  sudo reboot"
