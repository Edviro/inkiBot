#!/usr/bin/env python3
"""
==============================================================
 PUENTE  ESP32 (USB)  <-->  BROKER MQTT EN LA NUBE
 Corre en la Lenovo del robot.

   ESP32 --USB--> puente.py --internet--> broker (EMQX Cloud)

 - Lee el JSON que manda la ESP32 por el cable y lo publica
   en los topics robot/sensores/* y robot/estado/*.
 - Escucha robot/control/* en el broker y se lo manda a la
   ESP32 por el cable ("motor:adelante", "luz:on", ...).

 La configuración se lee de lenovo/config.env (ver config.env.example).
 Para probarlo a mano:   python3 lenovo/puente.py
==============================================================
"""

import glob
import json
import os
import socket
import ssl
import sys
import threading
import time

import paho.mqtt.client as mqtt
import serial

# --------------------------------------------------------------
# Configuración
# --------------------------------------------------------------

AQUI = os.path.dirname(os.path.abspath(__file__))


def cargar_env(ruta):
    """Lee KEY=valor de config.env (sin pisar variables ya definidas)."""
    if not os.path.exists(ruta):
        return
    with open(ruta, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            k, v = linea.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


cargar_env(os.path.join(AQUI, "config.env"))

MQTT_HOST = os.environ.get("MQTT_HOST", "localhost")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "8883"))
MQTT_TLS = os.environ.get("MQTT_TLS", "1") == "1"
MQTT_USER = os.environ.get("MQTT_USER", "")
MQTT_PASS = os.environ.get("MQTT_PASS", "")
MQTT_CA = os.environ.get("MQTT_CA", "")  # opcional: ruta a emqxsl-ca.crt
PREFIX = os.environ.get("TOPIC_PREFIX", "")
SERIAL_PORT = os.environ.get("SERIAL_PORT", "auto")
BAUD = int(os.environ.get("SERIAL_BAUD", "115200"))

# Para no gastar la cuota gratis: sensores como máximo cada 1 s,
# y si no cambian, se reenvían cada 5 s igual (para que se vea vivo).
CADA_SENSORES = 1.0
LATIDO = 5.0
# Si la ESP32 no manda nada en este tiempo, se considera desconectada.
SIN_DATOS = 3.0

T = lambda t: PREFIX + t  # noqa: E731

MOTORES = {"adelante", "atras", "izquierda", "derecha", "parar"}
LUCES = {"on", "off", "auto"}


def log(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


# --------------------------------------------------------------
# Puerto serie (ESP32)
# --------------------------------------------------------------

puerto = None
lock_serie = threading.Lock()


def buscar_puerto():
    if SERIAL_PORT != "auto":
        return SERIAL_PORT if os.path.exists(SERIAL_PORT) else None
    for patron in ("/dev/ttyUSB*", "/dev/ttyACM*"):
        encontrados = sorted(glob.glob(patron))
        if encontrados:
            return encontrados[0]
    return None


def abrir_serie():
    ruta = buscar_puerto()
    if not ruta:
        return None
    s = serial.Serial()
    s.port = ruta
    s.baudrate = BAUD
    s.timeout = 1
    # Evita (en la mayoría de placas) que la ESP32 se reinicie al abrir
    s.dtr = False
    s.rts = False
    s.open()
    log("ESP32 conectada en", ruta)
    return s


def enviar_a_esp32(texto):
    with lock_serie:
        if puerto is None:
            log("No hay ESP32 conectada; se ignora:", texto)
            return
        try:
            puerto.write((texto + "\n").encode())
            log("-> ESP32", texto)
        except (serial.SerialException, OSError) as e:
            log("Error escribiendo a la ESP32:", e)


# --------------------------------------------------------------
# MQTT
# --------------------------------------------------------------

cliente = mqtt.Client(
    mqtt.CallbackAPIVersion.VERSION2,
    client_id=f"puente-{socket.gethostname()}",
)
if MQTT_USER:
    cliente.username_pw_set(MQTT_USER, MQTT_PASS)
if MQTT_TLS:
    cliente.tls_set(ca_certs=MQTT_CA or None, cert_reqs=ssl.CERT_REQUIRED)
# Si la Lenovo se cae o pierde internet, el broker avisa solo:
cliente.will_set(T("robot/estado/conexion"), "ESP32_DESCONECTADO", qos=1, retain=True)
cliente.reconnect_delay_set(min_delay=1, max_delay=10)

ultimo = {}          # último valor publicado por topic
ultimo_t = {}        # cuándo se publicó
esp32_online = False


def publicar(topic, valor, forzar=False):
    """Publica (retained) solo si cambió o si toca el latido."""
    ahora = time.time()
    if not forzar and ultimo.get(topic) == valor and ahora - ultimo_t.get(topic, 0) < LATIDO:
        return
    if cliente.is_connected():
        cliente.publish(T(topic), valor, qos=0, retain=True)
        ultimo[topic] = valor
        ultimo_t[topic] = ahora


def marcar_esp32(online):
    global esp32_online
    if online != esp32_online:
        esp32_online = online
        log("ESP32", "EN LÍNEA" if online else "SIN DATOS")
    publicar("robot/estado/conexion", "ESP32_CONECTADO" if online else "ESP32_DESCONECTADO", forzar=True)


def al_conectar(c, userdata, flags, reason_code, properties):
    if reason_code.is_failure:
        log("Broker rechazó la conexión:", reason_code, "(¿usuario/clave?)")
        return
    log("Conectado al broker", MQTT_HOST)
    c.subscribe(T("robot/control/#"), qos=1)
    ultimo.clear()  # al reconectar, reenviar todo
    marcar_esp32(esp32_online)


def al_desconectar(c, userdata, flags, reason_code, properties):
    log("Desconectado del broker:", reason_code, "- reintentando…")


def al_mensaje(c, userdata, msg):
    topic = msg.topic[len(PREFIX):]
    valor = msg.payload.decode(errors="ignore").strip().lower()
    if topic == "robot/control/motor" and valor in MOTORES:
        enviar_a_esp32("motor:" + valor)
    elif topic == "robot/control/luz" and valor in LUCES:
        enviar_a_esp32("luz:" + valor)
    else:
        log("Orden desconocida:", msg.topic, valor)


cliente.on_connect = al_conectar
cliente.on_disconnect = al_desconectar
cliente.on_message = al_mensaje


# --------------------------------------------------------------
# Datos de la ESP32 -> broker
# --------------------------------------------------------------

ultimo_envio_sensores = 0.0


def distancia(v):
    try:
        v = float(v)
    except (TypeError, ValueError):
        return "SIN_LECTURA"
    return f"{v:.2f}" if v > 0 else "SIN_LECTURA"


def procesar_linea(linea):
    global ultimo_envio_sensores
    if not linea.startswith("{"):
        if linea:
            log("ESP32:", linea)
        return
    try:
        d = json.loads(linea)
    except json.JSONDecodeError:
        return

    if "evento" in d:
        publicar("robot/estado/evento", str(d["evento"]), forzar=True)
        log("Evento:", d["evento"])
        return

    # Actuadores: al instante, apenas cambian
    publicar("robot/estado/luz", "ENCENDIDA" if d.get("luz") else "APAGADA")
    publicar("robot/estado/luz_modo", "AUTO" if d.get("modo") == "AUTO" else "MANUAL")
    publicar("robot/estado/motor", str(d.get("motor", "parar")))
    publicar("robot/sensores/pir", "MOVIMIENTO_DETECTADO" if d.get("pir") else "SIN_MOVIMIENTO")

    # Distancias: máximo 1 vez por segundo
    ahora = time.time()
    if ahora - ultimo_envio_sensores >= CADA_SENSORES:
        ultimo_envio_sensores = ahora
        publicar("robot/sensores/delantero_cm", distancia(d.get("del")))
        publicar("robot/sensores/trasero_cm", distancia(d.get("tra")))


# --------------------------------------------------------------
# Bucle principal
# --------------------------------------------------------------

def main():
    global puerto
    log(f"Broker: {MQTT_HOST}:{MQTT_PORT} TLS={'sí' if MQTT_TLS else 'no'} usuario={MQTT_USER or '-'}")
    cliente.connect_async(MQTT_HOST, MQTT_PORT, keepalive=20)
    cliente.loop_start()

    ultimo_dato = 0.0
    aviso_sin_puerto = 0.0

    while True:
        if puerto is None:
            try:
                with lock_serie:
                    puerto = abrir_serie()
            except (serial.SerialException, OSError) as e:
                log("No se pudo abrir el puerto:", e)
                puerto = None
            if puerto is None:
                if time.time() - aviso_sin_puerto > 15:
                    log("Esperando la ESP32 por USB (/dev/ttyUSB* o /dev/ttyACM*)…")
                    aviso_sin_puerto = time.time()
                if esp32_online:
                    marcar_esp32(False)
                time.sleep(2)
                continue

        try:
            crudo = puerto.readline()
        except (serial.SerialException, OSError) as e:
            log("Se perdió la ESP32:", e)
            with lock_serie:
                try:
                    puerto.close()
                except Exception:
                    pass
                puerto = None
            marcar_esp32(False)
            continue

        if crudo:
            linea = crudo.decode(errors="ignore").strip()
            if linea.startswith("{"):
                ultimo_dato = time.time()
                if not esp32_online:
                    marcar_esp32(True)
            procesar_linea(linea)

        if esp32_online and time.time() - ultimo_dato > SIN_DATOS:
            marcar_esp32(False)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        log("Saliendo…")
        if cliente.is_connected():
            cliente.publish(T("robot/estado/conexion"), "ESP32_DESCONECTADO", qos=1, retain=True).wait_for_publish(2)
        cliente.loop_stop()
        sys.exit(0)
