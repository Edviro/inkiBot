"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import mqtt, { MqttClient } from "mqtt";

// ------------------------------------------------------------------
// Configuración (variables de entorno, en Vercel o en .env.local)
//   NEXT_PUBLIC_MQTT_URL   wss://xxxx.emqxsl.com:8084/mqtt
//   NEXT_PUBLIC_MQTT_USER  usuario creado en EMQX
//   NEXT_PUBLIC_MQTT_PASS  su clave
// ------------------------------------------------------------------

const PREFIX = process.env.NEXT_PUBLIC_TOPIC_PREFIX ?? "";
const MQTT_URL = process.env.NEXT_PUBLIC_MQTT_URL || "ws://localhost:9001";
const MQTT_USER = process.env.NEXT_PUBLIC_MQTT_USER || undefined;
const MQTT_PASS = process.env.NEXT_PUBLIC_MQTT_PASS || undefined;

export type Motor = "adelante" | "atras" | "izquierda" | "derecha" | "parar";
export type Mood = "feliz" | "sorpresa" | "alerta" | "dormido";

export type LogLine = { t: number; topic: string; value: string; dir: "in" | "out" };

export type RobotState = {
  broker: "conectando" | "conectado" | "desconectado";
  esp32: boolean;            // ESP32 mandando datos (lo informa el puente)
  delantero: number | null;  // cm, null = sin lectura
  trasero: number | null;
  pir: boolean;
  luz: boolean;
  luzModo: "AUTO" | "MANUAL";
  motor: Motor;
  evento: { texto: string; t: number } | null;
  ultimoDato: number;        // timestamp del último dato de sensores
  log: LogLine[];
};

const inicial: RobotState = {
  broker: "conectando",
  esp32: false,
  delantero: null,
  trasero: null,
  pir: false,
  luz: false,
  luzModo: "AUTO",
  motor: "parar",
  evento: null,
  ultimoDato: 0,
  log: [],
};

const num = (v: string) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};

export const DISTANCIA_ALERTA = 20; // cm: la carita se asusta

export function useRobot() {
  const [s, setS] = useState<RobotState>(inicial);
  const [ahora, setAhora] = useState(() => Date.now());
  const cliente = useRef<MqttClient | null>(null);

  useEffect(() => {
    const c = mqtt.connect(MQTT_URL, {
      clientId: "web-" + Math.random().toString(16).slice(2, 8),
      username: MQTT_USER,
      password: MQTT_PASS,
      clean: true,
      reconnectPeriod: 2000,
      connectTimeout: 5000,
    });
    cliente.current = c;

    c.on("connect", () => {
      setS((p) => ({ ...p, broker: "conectado" }));
      c.subscribe(PREFIX + "robot/#");
    });
    c.on("reconnect", () => setS((p) => ({ ...p, broker: "conectando" })));
    c.on("close", () => setS((p) => ({ ...p, broker: "desconectado" })));
    c.on("offline", () => setS((p) => ({ ...p, broker: "desconectado" })));

    c.on("message", (topicCompleto, payload, packet) => {
      const topic = topicCompleto.slice(PREFIX.length);
      const v = payload.toString().trim();
      const t = Date.now();
      // Los "retained" son datos viejos guardados en el broker:
      // no cuentan como dato fresco de sensores.
      const fresco = !packet.retain;

      setS((p) => {
        const n: RobotState = { ...p };
        switch (topic) {
          case "robot/sensores/delantero_cm":
            n.delantero = num(v);
            if (fresco) n.ultimoDato = t;
            break;
          case "robot/sensores/trasero_cm":
            n.trasero = num(v);
            if (fresco) n.ultimoDato = t;
            break;
          case "robot/sensores/pir":
            n.pir = v === "MOVIMIENTO_DETECTADO";
            if (fresco) n.ultimoDato = t;
            break;
          case "robot/estado/luz":
            n.luz = v === "ENCENDIDA";
            break;
          case "robot/estado/luz_modo":
            n.luzModo = v === "MANUAL" ? "MANUAL" : "AUTO";
            break;
          case "robot/estado/motor":
            n.motor = (v.toLowerCase() as Motor) || "parar";
            break;
          case "robot/estado/conexion":
            n.esp32 = v === "ESP32_CONECTADO";
            break;
          case "robot/estado/evento":
            if (fresco) n.evento = { texto: v, t };
            break;
        }
        n.log = [{ t, topic, value: v, dir: "in" as const }, ...p.log].slice(0, 40);
        return n;
      });
    });

    const reloj = setInterval(() => setAhora(Date.now()), 500);
    return () => {
      clearInterval(reloj);
      c.end(true);
    };
  }, []);

  const publicar = useCallback((topic: string, value: string) => {
    const c = cliente.current;
    if (!c?.connected) return;
    c.publish(PREFIX + topic, value);
    setS((p) => ({
      ...p,
      log: [{ t: Date.now(), topic, value, dir: "out" as const }, ...p.log].slice(0, 40),
    }));
  }, []);

  const mover = useCallback((m: Motor) => publicar("robot/control/motor", m), [publicar]);
  const ponerLuz = useCallback((m: "on" | "off" | "auto") => publicar("robot/control/luz", m), [publicar]);

  // "En vivo": hay broker y el puente dice que la ESP32 manda datos
  const enVivo = s.broker === "conectado" && s.esp32;

  const cerca = (d: number | null) => d !== null && d < DISTANCIA_ALERTA;
  const obstaculo = cerca(s.delantero) || cerca(s.trasero);

  let mood: Mood = "feliz";
  if (!enVivo) mood = "dormido";
  else if (obstaculo) mood = "alerta";
  else if (s.pir) mood = "sorpresa";

  const eventoReciente = s.evento && ahora - s.evento.t < 3000 ? s.evento.texto : null;

  return { ...s, enVivo, mood, obstaculo, eventoReciente, mover, ponerLuz };
}
