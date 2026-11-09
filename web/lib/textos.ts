import type { Mood } from "./useRobot";

export const NOMBRE = process.env.NEXT_PUBLIC_ROBOT_NAME ?? "INKI";

export const fmtCm = (d: number | null) => (d === null ? "—" : d.toFixed(0));

export function mensaje(r: {
  mood: Mood;
  broker: string;
  esp32: boolean;
  delantero: number | null;
  trasero: number | null;
  eventoReciente: string | null;
}) {
  if (r.broker !== "conectado") return "Buscando el broker MQTT…";
  if (!r.esp32) return "Esperando a la ESP32 (¿cable USB? ¿puente?)…";
  if (r.eventoReciente?.startsWith("FRENO")) return "¡Frené! Había algo muy cerca";
  if (r.mood === "alerta") {
    const d = Math.min(r.delantero ?? 999, r.trasero ?? 999);
    const lado = (r.delantero ?? 999) <= (r.trasero ?? 999) ? "adelante" : "atrás";
    return `¡Cuidado! Obstáculo ${lado} a ${d.toFixed(0)} cm`;
  }
  if (r.mood === "sorpresa") return "¡Hola! Te veo 👋";
  return "Todo bien por aquí";
}

export function colorDistancia(d: number | null) {
  if (d === null) return "var(--suave)";
  if (d < 20) return "var(--rojo)";
  if (d < 50) return "var(--ambar)";
  return "var(--cian)";
}
