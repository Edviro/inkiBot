"use client";

// ============================================================
// PANTALLA DEL ROBOT (monitor HDMI de la Lenovo)
// http://localhost:3000/cara  en modo kiosco
// ============================================================

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Cara from "../Cara";
import { useRobot, DISTANCIA_ALERTA } from "@/lib/useRobot";
import { NOMBRE, colorDistancia, fmtCm, mensaje } from "@/lib/textos";

// QR de WiFi solo si se configura (en modo nube el celular usa sus datos)
const SSID = process.env.NEXT_PUBLIC_WIFI_SSID ?? "";
const PASS = process.env.NEXT_PUBLIC_WIFI_PASS ?? "";

const COLOR_MSG = {
  feliz: "var(--cian)",
  sorpresa: "#fde047",
  alerta: "var(--rojo)",
  dormido: "var(--suave)",
};

export default function PantallaRobot() {
  const r = useRobot();
  const [qrWifi, setQrWifi] = useState("");
  const [qrWeb, setQrWeb] = useState("");

  useEffect(() => {
    const op = { margin: 1, width: 240 };
    if (SSID) QRCode.toDataURL(`WIFI:T:WPA;S:${SSID};P:${PASS};;`, op).then(setQrWifi);
    // El QR abre esta misma web (la de Vercel), en la página de control
    const control = process.env.NEXT_PUBLIC_CONTROL_URL || window.location.origin;
    QRCode.toDataURL(control, op).then(setQrWeb);
  }, []);

  const cerca = (d: number | null) => d !== null && d < DISTANCIA_ALERTA;

  return (
    <main className="robot">
      <div className="robot-top">
        <span>{NOMBRE}</span>
        <span style={{ marginRight: qrWifi ? "28vmin" : "16vmin" }}>
          Broker {r.broker === "conectado" ? "●" : "○"} · ESP32 {r.esp32 ? "●" : "○"}
        </span>
      </div>

      <div className="qr">
        {qrWifi && (
          <figure>
            <img src={qrWifi} alt="QR WiFi" />
            <figcaption>1 · WiFi</figcaption>
          </figure>
        )}
        {qrWeb && (
          <figure>
            <img src={qrWeb} alt="QR control" />
            <figcaption>{qrWifi ? "2 · " : ""}Contrólame</figcaption>
          </figure>
        )}
      </div>

      <div className="robot-cara">
        <Cara mood={r.mood} motor={r.motor} luz={r.luz} />
      </div>

      <div className="robot-msg" style={{ color: COLOR_MSG[r.mood] }}>
        {mensaje(r)}
      </div>

      <div className="robot-datos">
        <div className={`dato ${cerca(r.delantero) ? "alerta" : ""}`}>
          <div className="dato-l">Delante</div>
          <div className="dato-v" style={{ color: colorDistancia(r.delantero) }}>
            {fmtCm(r.delantero)}
            <small>cm</small>
          </div>
        </div>
        <div className={`dato ${cerca(r.trasero) ? "alerta" : ""}`}>
          <div className="dato-l">Detrás</div>
          <div className="dato-v" style={{ color: colorDistancia(r.trasero) }}>
            {fmtCm(r.trasero)}
            <small>cm</small>
          </div>
        </div>
        <div className={`dato ${r.pir ? "ok" : ""}`}>
          <div className="dato-l">Presencia</div>
          <div className="dato-v texto">{r.pir ? "Sí" : "No"}</div>
        </div>
        <div className={`dato ${r.luz ? "luz" : ""}`}>
          <div className="dato-l">Luz · {r.luzModo === "AUTO" ? "auto" : "manual"}</div>
          <div className="dato-v texto">{r.luz ? "ON" : "OFF"}</div>
        </div>
        <div className="dato">
          <div className="dato-l">Motor</div>
          <div className="dato-v texto" style={{ textTransform: "capitalize" }}>{r.motor}</div>
        </div>
      </div>
    </main>
  );
}
