# Robot IoT · ESP32 + Python + MQTT en la nube + Next.js

Los sensores del robot se publican en un **broker MQTT en la nube** y desde ese broker se controlan los actuadores, **desde cualquier lugar con internet**.

```
                                          ┌──────────────────────────────┐
 ┌────────────┐  USB   ┌───────────────┐  │  BROKER EMQX (nube, gratis)  │  ◄── celular (datos móviles)
 │   ESP32    │ ─────► │ Lenovo        │  │  mqtts :8883  ·  wss :8084   │  ◄── web en Vercel
 │ sensores   │ ◄───── │ puente.py     │◄►│                              │  ◄── MQTTX (profesor)
 │ motores/luz│ serial │ (Python)      │  └──────────────────────────────┘
 └────────────┘        │ pantalla HDMI │ ── muestra https://tu-web.vercel.app/cara
                       └───────────────┘
```

- **ESP32**: lee sensores y mueve actuadores. Le habla a la Lenovo por el **cable USB** (no usa WiFi para esto).
- **Lenovo / `puente.py`**: traduce entre el cable USB y el broker en la nube. Arranca solo.
- **Broker EMQX Serverless**: gratis y sin tarjeta. Todos se conectan aquí.
- **Web Next.js en Vercel**: `/` = control desde el celular · `/cara` = carita que muestra la pantalla del robot.

> **Plan B sin internet:** la ESP32 sigue creando el WiFi `Robot_ESP32` con su página en `http://192.168.4.1`.

## Estructura

| Carpeta | Qué es |
|---|---|
| `esp32/robot_esp32/` | Sketch de Arduino v3 (comunicación por USB) |
| `lenovo/` | `puente.py`, configuración, instalador y modo kiosco |
| `web/` | App Next.js (control + carita) y simulador |

## Topics MQTT

| Topic | Sentido | Valores |
|---|---|---|
| `robot/sensores/delantero_cm` | robot → broker | `23.45` / `SIN_LECTURA` |
| `robot/sensores/trasero_cm` | robot → broker | `23.45` / `SIN_LECTURA` |
| `robot/sensores/pir` | robot → broker | `MOVIMIENTO_DETECTADO` / `SIN_MOVIMIENTO` |
| `robot/estado/luz` | robot → broker | `ENCENDIDA` / `APAGADA` |
| `robot/estado/luz_modo` | robot → broker | `AUTO` / `MANUAL` |
| `robot/estado/motor` | robot → broker | `adelante` `atras` `izquierda` `derecha` `parar` |
| `robot/estado/conexion` | robot → broker | `ESP32_CONECTADO` / `ESP32_DESCONECTADO` |
| `robot/estado/evento` | robot → broker | `FRENO_OBSTACULO_DELANTE` / `..._DETRAS` |
| `robot/control/motor` | broker → robot | `adelante` `atras` `izquierda` `derecha` `parar` |
| `robot/control/luz` | broker → robot | `on` / `off` / `auto` |

Protocolo por el cable USB (115200 baudios): la ESP32 manda cada 500 ms
`{"del":23.45,"tra":-1,"pir":1,"luz":0,"modo":"AUTO","motor":"parar"}`
y recibe `motor:adelante`, `luz:on`, etc. Esas órdenes también se pueden escribir a mano en el Monitor Serie.

## Puesta en marcha (resumen)

La guía detallada para principiantes está en **`GUIA-COMPANERO.md`**.

1. **EMQX** (https://accounts.emqx.com/signup) → *New Deployment* → **Serverless** (spend limit 0) → *Access Control → Authentication* → crea **dos usuarios**: `robot` (para el puente) y `web` (para la web).
2. **ESP32** → sube `esp32/robot_esp32/robot_esp32.ino` (no necesita librerías extra) y conéctala por USB a la Lenovo.
3. **Vercel** → importa el repo, **Root Directory = `web`**, y agrega las variables de `web/.env.example`:
   ```
   NEXT_PUBLIC_MQTT_URL=wss://<tu-host>.emqxsl.com:8084/mqtt
   NEXT_PUBLIC_MQTT_USER=web
   NEXT_PUBLIC_MQTT_PASS=...
   ```
4. **Lenovo** (con internet):
   ```bash
   cp lenovo/config.env.example lenovo/config.env && nano lenovo/config.env
   sudo bash lenovo/instalar.sh
   sudo reboot
   ```

## Para el examen

Con **MQTTX** (https://mqttx.app) conectado al mismo broker (host de EMQX, puerto 8883, SSL activado, usuario y clave):

- Suscríbete a `robot/#` → se ven los sensores en vivo **en el broker**.
- Publica `on` en `robot/control/luz` → se prende la luz **desde el broker**.
- Abre la web de Vercel en un celular con **datos móviles** → control **remoto** real.

## Probar sin el robot

```bash
cd web
cp .env.example .env.local      # pon tus datos de EMQX
npm install
npm run dev                     # http://localhost:3000  y  /cara
node simulador-esp32.mjs        # robot falso: manda sensores y responde órdenes
```

## Problemas comunes

| Síntoma | Revisa |
|---|---|
| Web: "Broker" en rojo | URL `wss://…:8084/mqtt`, usuario `web` y clave en Vercel. Tras cambiar variables: **Redeploy** |
| Web: "ESP32" en rojo | En la Lenovo: `journalctl -u robot-puente -f` |
| Puente: `Not authorized` / `Bad user name or password` | Usuario/clave en `lenovo/config.env` |
| Puente: error de certificado (`CERTIFICATE_VERIFY_FAILED`) | `wget -P lenovo https://assets.emqx.com/data/emqxsl-ca.crt` y en `config.env`: `MQTT_CA=/ruta/a/lenovo/emqxsl-ca.crt` |
| Puente: "Esperando la ESP32 por USB" | Cable de datos, `ls /dev/ttyUSB* /dev/ttyACM*`, reinicia tras instalar (permiso `dialout`) |
| No aparece la carita | `bash lenovo/kiosco.sh` a mano · revisa `CARA_URL` en `config.env` |

> **Seguridad:** el usuario `web` queda visible para quien abra la página (las variables `NEXT_PUBLIC_*` viajan al navegador). Para un proyecto de clase está bien; si alguien lo usa mal, borra ese usuario en EMQX y crea otro.
