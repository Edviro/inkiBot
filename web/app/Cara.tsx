"use client";

import { useEffect, useState } from "react";
import type { Mood, Motor } from "@/lib/useRobot";

// Carita del robot en SVG. Cambia según el estado de ánimo (mood)
// y mira hacia donde se mueve el robot.

const COLOR: Record<Mood, string> = {
  feliz: "#5eead4",
  sorpresa: "#fde047",
  alerta: "#fb7185",
  dormido: "#475569",
};

const MIRADA: Record<Motor, [number, number]> = {
  parar: [0, 0],
  adelante: [0, -10],
  atras: [0, 12],
  izquierda: [-28, 0],
  derecha: [28, 0],
};

export default function Cara({
  mood,
  motor = "parar",
  luz = false,
  fondo = "#05070d",
}: {
  mood: Mood;
  motor?: Motor;
  luz?: boolean;
  fondo?: string;
}) {
  const [parpadeo, setParpadeo] = useState(false);

  // Parpadeo aleatorio cada 2.5–5.5 s
  useEffect(() => {
    if (mood === "dormido") return;
    let t: ReturnType<typeof setTimeout>;
    const ciclo = () => {
      t = setTimeout(() => {
        setParpadeo(true);
        setTimeout(() => setParpadeo(false), 140);
        ciclo();
      }, 2500 + Math.random() * 3000);
    };
    ciclo();
    return () => clearTimeout(t);
  }, [mood]);

  const color = COLOR[mood];
  const [mx, my] = mood === "dormido" ? [0, 8] : MIRADA[motor];

  // Alto del ojo según el ánimo
  const alto = mood === "dormido" ? 8 : mood === "feliz" ? 86 : 104;
  const ancho = mood === "alerta" ? 92 : 74;
  const escalaY = parpadeo ? 0.08 : 1;

  const ojo = (cx: number) => (
    <g
      style={{
        transform: `translate(${mx}px, ${my}px)`,
        transition: "transform 380ms cubic-bezier(.3,1.4,.5,1)",
      }}
    >
      <rect
        filter="url(#brillo)"
        x={cx - ancho / 2}
        y={115 - alto / 2}
        width={ancho}
        height={alto}
        rx={mood === "dormido" ? 4 : 32}
        fill={color}
        style={{
          transformBox: "fill-box",
          transformOrigin: "center",
          transform: `scaleY(${escalaY})`,
          transition: "all 260ms ease, transform 90ms ease",
        }}
      />
      {/* "Mejilla" que tapa la parte de abajo del ojo: da la sonrisa ^ ^ */}
      <ellipse
        cx={cx}
        cy={178}
        rx={64}
        ry={44}
        fill={fondo}
        opacity={mood === "feliz" && !parpadeo ? 1 : 0}
        style={{ transition: "opacity 200ms ease" }}
      />
    </g>
  );

  return (
    <svg viewBox="0 0 400 300" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <defs>
        <filter id="brillo" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g>
        {ojo(125)}
        {ojo(275)}

        {/* Boca */}
        <g
          filter="url(#brillo)"
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          style={{ transition: "stroke 300ms" }}
        >
          <path d="M160 222 Q200 256 240 222" opacity={mood === "feliz" ? 1 : 0} style={{ transition: "opacity 200ms" }} />
          <ellipse cx="200" cy="236" rx="22" ry="18" opacity={mood === "sorpresa" ? 1 : 0} style={{ transition: "opacity 200ms" }} />
          <path d="M162 238 L178 226 L194 238 L210 226 L226 238 L238 230" opacity={mood === "alerta" ? 1 : 0} style={{ transition: "opacity 200ms" }} />
          <path d="M182 236 L218 236" opacity={mood === "dormido" ? 1 : 0} style={{ transition: "opacity 200ms" }} />
        </g>

        {/* Zzz cuando duerme */}
        {mood === "dormido" && (
          <text x="320" y="70" filter="url(#brillo)" fill={color} fontSize="34" fontWeight="700" className="zzz">
            z<tspan dx="4" dy="-14" fontSize="26">z</tspan>
            <tspan dx="4" dy="-12" fontSize="20">z</tspan>
          </text>
        )}

        {/* Foco encendido */}
        {luz && (
          <g transform="translate(200 22)" filter="url(#brillo)">
            <circle r="12" fill="#fbbf24" />
            <g stroke="#fbbf24" strokeWidth="4" strokeLinecap="round">
              <path d="M-24 0 H-18 M18 0 H24 M0 -24 V-18 M-17 -17 L-13 -13 M17 -17 L13 -13" />
            </g>
          </g>
        )}
      </g>
    </svg>
  );
}
