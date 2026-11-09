# 🤖 Guía paso a paso: Robot IoT en la nube (para el compañero)

Tranquilo, no necesitas saber programar. Sigue los pasos **en orden** y marca cada casilla ✅ cuando termines.

## ¿Qué vamos a armar?

```
ESP32 ──cable USB──► Lenovo ──internet──► BROKER EN LA NUBE ◄── celular / profesor / cualquiera
                       │                        ▲
                       └─ pantallita ───────────┘ (muestra la carita)
```

1. La **ESP32** lee los sensores y mueve motores y luz. Va **conectada por USB a la Lenovo**.
2. La **Lenovo** tiene un programa en Python (`puente.py`) que pasa los datos de la ESP32 a la nube y las órdenes de la nube a la ESP32.
3. El **broker en la nube** (EMQX) es como un "cartero" en internet: todos le mandan y reciben mensajes.
4. La **página web** (en Vercel) se abre desde cualquier celular, en cualquier lugar.

Vas a hacer 7 cosas:

1. Crear cuentas: GitHub, EMQX y Vercel
2. Crear el broker en la nube (EMQX)
3. Abrir el ZIP y subirlo a GitHub
4. Publicar la página web (Vercel)
5. Cargar el programa en la ESP32
6. Instalar el puente en la Lenovo
7. Probar y preparar el examen

> ⏱️ Tiempo: 2 a 3 horas la primera vez.
> 🌐 Necesitas **internet** en todo momento (también la Lenovo).
> 📝 Ten a mano un **bloc de notas**: vas a copiar varias claves y direcciones. Guárdalas, las vas a usar después.

---

## 📖 Mini diccionario

| Palabra | Qué significa |
|---|---|
| **ESP32** | La plaquita que mueve motores, prende la luz y lee los sensores. |
| **Lenovo** | La placa de laptop encima del robot, con la pantallita. Tiene Linux. |
| **Broker MQTT** | El "cartero" en internet. La ESP32 le manda datos y él se los pasa al celular, y al revés con las órdenes. |
| **EMQX** | La empresa que nos da el broker gratis en la nube. |
| **Topic** | La "dirección" de un mensaje. Ej.: `robot/control/luz`. |
| **Vercel** | Servicio gratis que publica nuestra página web en internet. |
| **GitHub** | Donde se guarda el código del proyecto en internet. |
| **Terminal** | La ventana negra donde se escriben comandos (en la Lenovo). |

---

## 1️⃣ Crear las cuentas

### 1.1 GitHub
1. Entra a **https://github.com/signup**
2. Pon tu **correo** → **Continue** → crea una **contraseña** → **Continue** → elige un **nombre de usuario** → **Continue**.
3. Resuelve la verificación y escribe el **código que llega a tu correo**.
4. Si pregunta por plan, elige **Free**.
5. **Pásale tu nombre de usuario a Eduardo** para que te agregue al repo. Te llegará un correo: ábrelo → **View invitation** → **Accept invitation**.

- [ ] Tengo GitHub y acepté la invitación al repo

### 1.2 EMQX (el broker en la nube)
1. Entra a **https://accounts.emqx.com/signup**
2. Llena nombre, correo, contraseña y **número de celular** (te pide verificarlo por SMS; usa uno real).
3. Te llega un **correo de confirmación** → ábrelo y confirma la cuenta.

- [ ] Tengo cuenta en EMQX

### 1.3 Vercel (para publicar la web)
1. Entra a **https://vercel.com/signup**
2. Si pregunta el tipo de uso, elige **Hobby** (gratis) y escribe tu nombre.
3. Elige **Continue with GitHub** → **Authorize Vercel**.

- [ ] Tengo cuenta en Vercel (conectada a mi GitHub)

---

## 2️⃣ Crear el broker en la nube (EMQX)

### 2.1 Crear el broker
1. Entra a **https://cloud.emqx.com/console/** (o inicia sesión en EMQX).
2. Si te pide crear un proyecto, ponle de nombre `robot` y créalo.
3. Clic en **New Deployment** (Nuevo despliegue).
4. Elige el plan **Serverless**.
5. En **Spend Limit** deja **0** (así nunca te cobran nada; solo usas lo gratis).
6. Ponle de nombre: `robot-iot`.
7. Acepta los términos → **Deploy**.
8. Espera 1–2 minutos hasta que diga **Running** (en verde).

- [ ] Mi broker dice "Running"

### 2.2 Copiar la dirección del broker
1. Entra a tu deployment `robot-iot` → pestaña **Overview** (Resumen).
2. Busca la **dirección / Address** del broker. Se parece a:
   ```
   k1a2b3c4.ala.us-east-1.emqxsl.com
   ```
3. Cópiala en tu bloc de notas como **HOST**.
4. Fíjate que los puertos digan **8883 (MQTT over TLS)** y **8084 (WebSocket over TLS)**.

- [ ] Tengo anotado el HOST

### 2.3 Crear los usuarios (como claves de acceso)
El broker no deja entrar a nadie sin usuario. Vamos a crear **dos**:

1. En tu deployment, menú **Access Control → Authentication**.
2. Clic en **Add** → Usuario: `robot` · Contraseña: inventa una (ej. `Robot-2026-xyz`) → **Confirm**.
3. Otra vez **Add** → Usuario: `web` · Contraseña: **otra diferente** → **Confirm**.
4. Anota los dos usuarios y contraseñas en tu bloc de notas.

> ¿Por qué dos? El de `web` queda visible en la página, así que si alguien lo usa mal, lo borras y creas otro sin tocar el robot.

- [ ] Creé los usuarios `robot` y `web`, y anoté sus claves

**Tu bloc de notas debe verse así:**
```
HOST:        k1a2b3c4.ala.us-east-1.emqxsl.com
robot:       Robot-2026-xyz
web:         Web-2026-abc
```

---

## 3️⃣ Abrir el ZIP y subirlo a GitHub

### 3.1 Abrir el ZIP
1. Guarda `robot-iot.zip` en tu **Escritorio**.
2. **Clic derecho** → **Extraer todo…** → **Extraer**.
3. Adentro de la carpeta `robot-iot` debes ver:
   ```
   esp32/     lenovo/     web/     README.md     GUIA-COMPANERO.md
   ```

- [ ] Descomprimí el ZIP

### 3.2 Instalar GitHub Desktop
1. Descarga de **https://desktop.github.com** e instálalo.
2. Ábrelo → **Sign in to GitHub.com** → **Authorize desktop**.
3. Te pide nombre y correo → los mismos de GitHub → **Finish**.

### 3.3 Descargar el repo y meter el proyecto
1. En GitHub Desktop: **File → Clone repository** → pestaña **GitHub.com** → elige el repo del grupo → **Clone**.
2. Abre la carpeta del repo (en GitHub Desktop: **Repository → Show in Explorer**).
3. **Copia todo lo que hay DENTRO** de `robot-iot` (las carpetas `esp32`, `lenovo`, `web` y los `.md`) y **pégalo dentro** de la carpeta del repo.
4. Vuelve a GitHub Desktop: verás los archivos nuevos a la izquierda.
5. Abajo, en **Summary**, escribe: `Proyecto robot IoT en la nube` → **Commit to main**.
6. Arriba → **Push origin**.
7. Entra al repo en github.com y comprueba que se ven las carpetas `esp32`, `lenovo` y `web`.

> ⚠️ **Nunca subas** carpetas `node_modules`, `.next`, `.venv` ni archivos `config.env` o `.env.local` (tienen claves). El archivo `.gitignore` ya los bloquea; no lo borres.

- [ ] El proyecto está en GitHub

---

## 4️⃣ Publicar la página web (Vercel)

1. Entra a **https://vercel.com/new**
2. En **Import Git Repository**, busca el repo del grupo → **Import**.
   (Si no aparece: **Adjust GitHub App Permissions** → dale acceso a ese repo.)
3. **Root Directory** → clic en **Edit** → elige la carpeta **`web`** → **Continue**. ⚠️ ¡Este paso es clave!
4. Abre **Environment Variables** y agrega estas 3 (Key = nombre, Value = valor). Cambia lo que está entre `< >` por lo de tu bloc de notas:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_MQTT_URL` | `wss://<HOST>:8084/mqtt` |
   | `NEXT_PUBLIC_MQTT_USER` | `web` |
   | `NEXT_PUBLIC_MQTT_PASS` | `<clave de web>` |

   Ejemplo del primero: `wss://k1a2b3c4.ala.us-east-1.emqxsl.com:8084/mqtt`

5. Clic en **Deploy**. Espera 1–3 minutos.
6. Cuando salga el confeti 🎉 → **Continue to Dashboard**. Arriba verás tu dirección, algo como:
   ```
   https://robot-iot-xxxx.vercel.app
   ```
   Anótala en tu bloc de notas como **WEB**.
7. Ábrela en tu celular. Debe salir la página del robot con **Broker** en 🟢 verde (ESP32 seguirá en rojo hasta el paso 6, es normal).

> Si te equivocaste en una variable: **Settings → Environment Variables** → corrígela → pestaña **Deployments** → los tres puntitos del último → **Redeploy**. (Sin redeploy no toma el cambio.)

- [ ] La web abre y "Broker" está en verde

---

## 5️⃣ Cargar el programa en la ESP32 (desde tu PC Windows)

### 5.1 Instalar Arduino IDE
1. **https://www.arduino.cc/en/software** → descarga **Arduino IDE 2.x** para Windows → **Just Download**.
2. Instala (siguiente, siguiente…). Si pregunta por instalar **drivers**, di **Sí** a todo.

### 5.2 Agregar las placas ESP32
1. Abre Arduino IDE → **File → Preferences**.
2. En **Additional boards manager URLs** pega esto → **OK**:
   ```
   https://espressif.github.io/arduino-esp32/package_esp32_index.json
   ```
3. **Tools → Board → Boards Manager** → busca **esp32** → en **"esp32 by Espressif Systems"** → **Install** (tarda 5–15 min).

> ✅ **No hay que instalar ninguna librería extra.** Esta versión no usa PubSubClient; el MQTT lo hace la Lenovo.

- [ ] Placas ESP32 instaladas

### 5.3 Abrir y subir el programa
1. **File → Open…** → `robot-iot\esp32\robot_esp32\robot_esp32.ino`
2. Conecta la ESP32 a tu PC con un **cable USB de datos** (si no aparece nada, prueba otro cable: algunos solo cargan).
3. **Tools → Board → esp32 → ESP32 Dev Module**
4. **Tools → Port** → el **COM** que aparezca (COM3, COM4…).
   - ¿No aparece ningún COM? Mira el chip cerca del USB de la placa:
     **CP2102/CP210x** → driver de https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers ·
     **CH340** → busca "driver CH340 Windows" (de WCH).
5. Clic en la **flecha →** (Upload).
6. Si se queda en `Connecting.....____` → **mantén presionado el botón BOOT** de la ESP32 hasta que empiece a subir.
7. Debe terminar con `Hard resetting via RTS pin...` ✅

- [ ] Programa subido

### 5.4 Probar la ESP32 sola (sin Lenovo)
1. **Tools → Serial Monitor** → abajo a la derecha: **115200 baud** y **New Line**.
2. Presiona el botón **EN** de la ESP32. Debes ver:
   ```
   # ROBOT ESP32 IoT v3 (USB)
   {"del":34.21,"tra":80.10,"pir":0,"luz":0,"modo":"AUTO","motor":"parar"}
   {"del":34.50,...
   ```
   (Una línea nueva cada medio segundo con los datos de los sensores.)
3. En la cajita de arriba escribe `luz:on` y presiona **Enter** → la luz se prende. `luz:auto` la regresa a automático.
4. **Cierra el Serial Monitor** (si queda abierto, después la Lenovo no puede usar la ESP32).

- [ ] La ESP32 manda datos y obedece `luz:on`

### 5.5 Conectar la ESP32 a la Lenovo
Desconéctala de tu PC y conéctala con el **cable USB a un puerto USB de la Lenovo**. Así se queda para siempre.

---

## 6️⃣ Instalar el puente en la Lenovo (Linux)

> ⚠️ La Lenovo debe estar conectada a un WiFi **con internet** (el de tu casa, el hotspot de un celular o el del aula). **NO** a `Robot_ESP32`.

### 6.1 Pasar el proyecto a la Lenovo
Copia `robot-iot.zip` a una **USB** → pásalo a la **Carpeta personal** de la Lenovo → clic derecho → **Extraer aquí**.

### 6.2 Abrir la terminal
Presiona **`Ctrl + Alt + T`**.

> 💡 **Cómo usar la terminal:**
> - Pega con **`Ctrl + Shift + V`** (no con `Ctrl + V`).
> - Presiona **Enter** después de cada comando.
> - Si pide **contraseña**, escribe la de la Lenovo. **No se ve nada al escribir**, es normal.

### 6.3 Entrar a la carpeta
```bash
cd ~/robot-iot
ls
```
Debes ver: `esp32  GUIA-COMPANERO.md  lenovo  README.md  web`

### 6.4 Escribir tus datos de la nube
1. Crea el archivo de configuración:
   ```bash
   cp lenovo/config.env.example lenovo/config.env
   nano lenovo/config.env
   ```
2. Se abre un editor dentro de la terminal. Muévete con las **flechas** y cambia estas líneas con lo de tu bloc de notas:
   ```
   MQTT_HOST=k1a2b3c4.ala.us-east-1.emqxsl.com     ← tu HOST (sin wss:// y sin puerto)
   MQTT_USER=robot
   MQTT_PASS=Robot-2026-xyz                        ← la clave del usuario robot
   CARA_URL=https://robot-iot-xxxx.vercel.app/cara ← tu WEB + /cara
   ```
3. Guarda: **`Ctrl + O`** → **Enter**. Sal: **`Ctrl + X`**.

- [ ] Llené `config.env`

### 6.5 Instalar todo
```bash
sudo bash lenovo/instalar.sh
```
Esto instala Python, las librerías **paho-mqtt** y **pyserial**, da permiso para usar el USB, deja el puente arrancando solo y programa la carita en pantalla completa. Tarda 2–10 minutos. Al final dice **LISTO**.

> ❌ Si sale un error en rojo, **toma foto de toda la pantalla** y pásala al grupo.

### 6.6 Ver que el puente funciona
```bash
journalctl -u robot-puente -f
```
Debes ver algo así:
```
Broker: k1a2b3c4...emqxsl.com:8883 TLS=sí usuario=robot
ESP32 conectada en /dev/ttyUSB0
ESP32 EN LÍNEA
Conectado al broker k1a2b3c4...emqxsl.com
```
Sal con **`Ctrl + C`**.

> Si dice `Permission denied` en `/dev/ttyUSB0` → reinicia la Lenovo (el permiso del USB se activa al reiniciar).

- [ ] El puente dice "ESP32 EN LÍNEA" y "Conectado al broker"

### 6.7 Inicio de sesión automático y reinicio
1. **Configuración → Usuarios** → **Desbloquear** → activa **Inicio de sesión automático**.
   (Si no lo encuentras, no pasa nada: solo inicia sesión a mano.)
2. Reinicia:
   ```bash
   sudo reboot
   ```
3. Al prender, en 1–2 minutos aparece **la carita** a pantalla completa. 🙂

- [ ] Veo la carita en la pantallita

---

## 7️⃣ Probar y preparar el examen

### 7.1 Desde el celular (en cualquier lugar)
1. **Apaga el WiFi del celular** y usa **datos móviles** (así demuestras que es remoto de verdad).
2. Escanea el **QR "Contrólame"** de la pantallita, o abre tu dirección **WEB**.
3. **Broker** 🟢 y **ESP32** 🟢 arriba.
4. Prueba:
   - Mantén presionada **▲** → avanza. Suelta → para.
   - **Encender / Apagar / Auto (PIR)** → la luz obedece.
   - Mano frente al sensor → la carita se pone **roja** 😮

- [ ] Lo controlo con datos móviles

### 7.2 MQTTX (para mostrarle el broker al profesor)
1. Descarga e instala **MQTTX** de **https://mqttx.app** en tu laptop.
2. Ábrelo → **+ New Connection**:
   - **Name:** `robot`
   - **Host:** elige `mqtts://` y pega tu **HOST**
   - **Port:** `8883`
   - **Username:** `web` · **Password:** la clave de web
   - **SSL/TLS:** activado
3. **Connect** (arriba a la derecha).
4. **+ New Subscription** → Topic: `robot/#` → **Confirm**. Empiezan a llegar los datos. 🎉

- [ ] Veo los datos del robot en MQTTX

---

## 🎓 Qué mostrar en el examen

El profesor pidió: *"mostrar los datos de los sensores en el broker y desde el broker controlar los actuadores, de manera remota"*.

**1. Datos en el broker:** en MQTTX, suscrito a `robot/#`, se ven llegar:
- `robot/sensores/delantero_cm` y `trasero_cm` → acerca la mano a los sensores
- `robot/sensores/pir` → muévete frente al sensor

**2. Controlar desde el broker:** en MQTTX, abajo a la derecha, escribe el topic y el mensaje y presiona el botón de enviar (avioncito):

| Topic | Mensaje | Qué pasa |
|---|---|---|
| `robot/control/luz` | `on` | Se prende la luz |
| `robot/control/luz` | `off` | Se apaga |
| `robot/control/luz` | `auto` | Se prende sola con el PIR |
| `robot/control/motor` | `adelante` | Avanza |
| `robot/control/motor` | `parar` | Se detiene |

(Elige el formato **Plaintext**, no JSON.)

**3. Remoto:** el celular con datos móviles controlando el robot y la carita reaccionando.

> 💡 El robot frena solo si detecta algo a menos de 15 cm, pero igual ten listo el `parar`.

---

## 🆘 Si algo falla

| Problema | Solución |
|---|---|
| Arduino no muestra puerto COM | Otro cable USB (de datos) o instala el driver CP210x / CH340 |
| Se queda en `Connecting.....____` | Mantén presionado **BOOT** mientras sube |
| `WiFi.h` / `WebServer.h` no encontrado | Placa equivocada: **Tools → Board → ESP32 Dev Module** |
| Web: **Broker** en rojo | Revisa las 3 variables en Vercel (sobre todo `wss://` y `:8084/mqtt`) y haz **Redeploy** |
| Web: **ESP32** en rojo | Mira el puente: `journalctl -u robot-puente -f` |
| Puente: `Not authorized` o `Bad user name or password` | Usuario o clave mal escritos en `lenovo/config.env` → corrige y `sudo systemctl restart robot-puente` |
| Puente: `CERTIFICATE_VERIFY_FAILED` | Ejecuta `wget -P ~/robot-iot/lenovo https://assets.emqx.com/data/emqxsl-ca.crt` y en `config.env` agrega `MQTT_CA=/home/TU_USUARIO/robot-iot/lenovo/emqxsl-ca.crt` → reinicia el puente |
| Puente: "Esperando la ESP32 por USB" | Revisa el cable. `ls /dev/ttyUSB* /dev/ttyACM*` debe mostrar algo |
| Puente: `Permission denied` | `sudo reboot` |
| No aparece la carita | `bash ~/robot-iot/lenovo/kiosco.sh` · revisa `CARA_URL` en `config.env` |
| Carita dormida (Zzz) | ¿La ESP32 está conectada y prendida? Mira el puente |
| No hay internet en el aula | Plan B: celular conectado al WiFi `Robot_ESP32` (clave `12345678`) → abrir `http://192.168.4.1` |

### Comandos útiles en la Lenovo
```bash
journalctl -u robot-puente -f            # ver el puente en vivo (salir: Ctrl+C)
sudo systemctl restart robot-puente      # reiniciar el puente
nano ~/robot-iot/lenovo/config.env       # cambiar datos de la nube
ls /dev/ttyUSB* /dev/ttyACM*             # ¿la Lenovo ve a la ESP32?
```

---

## ✅ Checklist final antes del examen

- [ ] ESP32 con el programa nuevo (dice **v3** en el Serial Monitor) y conectada por USB a la Lenovo
- [ ] Lenovo con internet (WiFi del aula o hotspot de un celular)
- [ ] Puente: "ESP32 EN LÍNEA" y "Conectado al broker"
- [ ] La carita aparece sola al prender la Lenovo
- [ ] Web en el celular con **datos móviles**: Broker 🟢 y ESP32 🟢
- [ ] MQTTX en una laptop, conectado y suscrito a `robot/#`
- [ ] Bloc de notas con HOST, usuarios y claves
- [ ] Batería cargada 🔋 y cable USB de repuesto
