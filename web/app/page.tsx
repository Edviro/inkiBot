"use client";

// ============================================================
// CONTROL REMOTO (para el celular)
// http://192.168.4.200:3000
// Todo pasa por el broker MQTT: lee robot/sensores/* y
// robot/estado/*, y publica en robot/control/*.
// ============================================================

import { useRef, useState } from "react";
import Cara from "./Cara";
import { useRobot, type Motor } from "@/lib/useRobot";
import { NOMBRE, colorDistancia, fmtCm, mensaje } from "@/lib/textos";

function Pill({ ok, wait, texto }: { ok: boolean; wait?: boolean; texto: string }) {
  return (
    <span className="pill">
      <span className={`dot ${ok ? "ok" : wait ? "wait" : "off"}`} />
      {texto}
    </span>
  );
}

function Distancia({ label, d }: { label: string; d: number | null }) {
  const pct = d === null ? 0 : Math.max(4, 100 - Math.min(d, 100));
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-valor" style={{ color: colorDistancia(d) }}>
        {fmtCm(d)}
        <small>cm</small>
      </div>
      <div className="barra">
        <i style={{ width: `${pct}%`, background: colorDistancia(d) }} />
      </div>
    </div>
  );
}

export default function Control() {
  const r = useRobot();
  const [pulsado, setPulsado] = useState<Motor | null>(null);
  const activo = useRef<Motor | null>(null);
  const listo = r.broker === "conectado" && r.esp32;

  // Mantener presionado = se mueve; soltar = para.
  const empezar = (m: Motor) => (e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    activo.current = m;
    setPulsado(m);
    r.mover(m);
  };
  const soltar = () => {
    if (!activo.current) return;
    activo.current = null;
    setPulsado(null);
    r.mover("parar");
  };

  const flecha = (m: Motor, clase: string, icono: string) => (
    <button
      className={`btn ${clase} ${pulsado === m || (!pulsado && r.motor === m) ? "activo" : ""}`}
      disabled={!listo}
      onPointerDown={empezar(m)}
      onPointerUp={soltar}
      onPointerCancel={soltar}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={m}
    >
      {icono}
    </button>
  );

  const luzSel = r.luzModo === "AUTO" ? "auto" : r.luz ? "on" : "off";

  return (
    <main className="ctl">
      <header className="ctl-top">
        <div>
          <h1 className="ctl-nombre">{NOMBRE}</h1>
          <div className="ctl-sub">Control remoto · MQTT</div>
        </div>
        <div className="pills">
          <Pill ok={r.broker === "conectado"} wait={r.broker === "conectando"} texto="Broker" />
          <Pill ok={r.esp32} texto="ESP32" />
        </div>
      </header>

      <div className="cara-mini">
        <Cara mood={r.mood} motor={r.motor} luz={r.luz} fondo="#0d1220" />
        <div className="cara-msg">{mensaje(r)}</div>
      </div>

      {r.eventoReciente?.startsWith("FRENO") && (
        <div className="aviso">⚠ Freno automático: obstáculo {r.eventoReciente.endsWith("DELANTE") ? "delante" : "detrás"}</div>
      )}

      <div className="seccion-titulo">
        Sensores
        <span>{r.enVivo ? "en vivo" : "sin datos"}</span>
      </div>
      <div className="grid2">
        <Distancia label="Delantero" d={r.delantero} />
        <Distancia label="Trasero" d={r.trasero} />
        <div className="card">
          <div className="card-label">Presencia (PIR)</div>
          <div className="card-valor texto" style={{ color: r.pir ? "var(--ambar)" : "var(--texto)" }}>
            {r.pir ? "Movimiento" : "Nadie"}
          </div>
        </div>
        <div className="card">
          <div className="card-label">Luz</div>
          <div className="card-valor texto" style={{ color: r.luz ? "var(--ambar)" : "var(--texto)" }}>
            {r.luz ? "Encendida" : "Apagada"}
            <small style={{ fontFamily: "var(--mono)" }}>{r.luzModo === "AUTO" ? "auto" : "manual"}</small>
          </div>
        </div>
      </div>

      <div className="seccion-titulo">
        Movimiento
        <span>motor: {r.motor}</span>
      </div>
      <div className="pad">
        {flecha("adelante", "arriba", "▲")}
        {flecha("izquierda", "izq", "◀")}
        <button className="btn stop" disabled={!listo} onClick={() => r.mover("parar")}>
          STOP
        </button>
        {flecha("derecha", "der", "▶")}
        {flecha("atras", "abajo", "▼")}
      </div>
      <div className="pad-nota">Mantén presionado para moverte · suelta para parar</div>

      <div className="seccion-titulo">Luz</div>
      <div className="seg">
        <button className={luzSel === "on" ? "on" : ""} disabled={!listo} onClick={() => r.ponerLuz("on")}>
          Encender
        </button>
        <button className={luzSel === "off" ? "off" : ""} disabled={!listo} onClick={() => r.ponerLuz("off")}>
          Apagar
        </button>
        <button className={luzSel === "auto" ? "auto" : ""} disabled={!listo} onClick={() => r.ponerLuz("auto")}>
          Auto (PIR)
        </button>
      </div>

      <div className="seccion-titulo">
        Mensajes del broker
        <span>
          <span style={{ color: "var(--cian)" }}>← recibe</span> · <span style={{ color: "var(--ambar)" }}>→ envía</span>
        </span>
      </div>
      <div className="log">
        {r.log.length === 0 && <div className="h">Sin mensajes todavía…</div>}
        {r.log.map((l, i) => (
          <div key={i}>
            <span className="h">{new Date(l.t).toLocaleTimeString("es-PE", { hour12: false })} </span>
            <span className={l.dir}>{l.dir === "in" ? "←" : "→"} </span>
            {l.topic} <span className={l.dir}>{l.value}</span>
          </div>
        ))}
      </div>

      <p className="pie">
        <a href="/cara">Ver pantalla del robot</a>
      </p>
    </main>
  );
}
