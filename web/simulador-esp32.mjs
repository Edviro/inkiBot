// ============================================================
// Simulador del robot (ESP32 + puente) — para probar la web
// SIN el robot. Publica sensores falsos al broker y responde
// a robot/control/* igual que el robot real.
//
//   node simulador-esp32.mjs
//
// Usa las mismas variables que la web (.env.local):
//   NEXT_PUBLIC_MQTT_URL, NEXT_PUBLIC_MQTT_USER, NEXT_PUBLIC_MQTT_PASS
// ============================================================

import { readFileSync, existsSync } from "node:fs";
import mqtt from "mqtt";

// Lee .env.local si existe
if (existsSync(".env.local")) {
  for (const l of readFileSync(".env.local", "utf8").split("\n")) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const url = process.env.NEXT_PUBLIC_MQTT_URL || "ws://localhost:9001";
const P = process.env.NEXT_PUBLIC_TOPIC_PREFIX || "";
const c = mqtt.connect(url, {
  clientId: "simulador-" + Math.random().toString(16).slice(2, 6),
  username: process.env.NEXT_PUBLIC_MQTT_USER,
  password: process.env.NEXT_PUBLIC_MQTT_PASS,
  will: { topic: P + "robot/estado/conexion", payload: "ESP32_DESCONECTADO", retain: true, qos: 1 },
});

let motor = "parar";
let modoAuto = true;
let luzManual = false;
let t = 0;

const pub = (topic, v) => c.publish(P + topic, String(v), { retain: true });

c.on("connect", () => {
  console.log("Simulador conectado a", url);
  c.subscribe([P + "robot/control/motor", P + "robot/control/luz"]);
  pub("robot/estado/conexion", "ESP32_CONECTADO");
  pub("robot/estado/motor", motor);
  pub("robot/estado/luz_modo", "AUTO");
});
c.on("error", (e) => console.log("Error:", e.message));

c.on("message", (topic, payload) => {
  const m = payload.toString().trim().toLowerCase();
  console.log("<-", topic, m);
  if (topic.endsWith("robot/control/motor")) {
    motor = m;
    pub("robot/estado/motor", motor);
  }
  if (topic.endsWith("robot/control/luz")) {
    if (m === "on") { modoAuto = false; luzManual = true; }
    if (m === "off") { modoAuto = false; luzManual = false; }
    if (m === "auto") modoAuto = true;
    pub("robot/estado/luz_modo", modoAuto ? "AUTO" : "MANUAL");
  }
});

setInterval(() => {
  t += 1;
  const delantero = 60 + 45 * Math.sin(t / 8);
  const trasero = 80 + 20 * Math.cos(t / 6);
  const pir = Math.sin(t / 10) > 0.6;
  pub("robot/sensores/delantero_cm", delantero.toFixed(2));
  pub("robot/sensores/trasero_cm", trasero.toFixed(2));
  pub("robot/sensores/pir", pir ? "MOVIMIENTO_DETECTADO" : "SIN_MOVIMIENTO");
  pub("robot/estado/luz", (modoAuto ? pir : luzManual) ? "ENCENDIDA" : "APAGADA");
}, 1000);
