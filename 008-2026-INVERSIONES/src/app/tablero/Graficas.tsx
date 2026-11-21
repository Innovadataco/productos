"use client";
import { n } from "./formato";

/** Minigráfica de precios; la línea punteada es el costo promedio vivo cuando se pasa. */
export function Linea({ serie, costoUnitario, alto = 28, ancho = 96, grosor = 1.6, sube }: {
  serie: readonly { precio: string }[]; costoUnitario?: number | null; alto?: number; ancho?: number; grosor?: number; sube: boolean;
}) {
  if (serie.length < 2) return <span className="muted">—</span>;
  const vals = serie.map((p) => n(p.precio));
  const ref = costoUnitario ?? null;
  const min = Math.min(...vals, ref ?? Infinity), max = Math.max(...vals, ref ?? -Infinity);
  const y = (v: number) => alto - 2 - ((v - min) / (max - min || 1)) * (alto - 4);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * ancho},${y(v)}`).join(" ");
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} className="linea" role="img"
      aria-label={`Precio de los últimos ${vals.length} cierres${ref ? " frente al costo promedio" : ""}`}>
      {ref ? <line x1={0} x2={ancho} y1={y(ref)} y2={y(ref)} className="costo" /> : null}
      <polyline points={pts} fill="none" className={sube ? "trazo gain" : "trazo loss"} strokeWidth={grosor} />
      <circle cx={ancho} cy={y(vals[vals.length - 1]!)} r={2.6} className={sube ? "punto gain" : "punto loss"} />
    </svg>
  );
}

/** Barra horizontal 0–100 (peso en el portafolio). Decorativa: el porcentaje va al lado en texto. */
export function Peso({ pct }: { pct: number }) {
  return (
    <span className="peso" aria-hidden="true">
      <span className="peso-fill" style={{ width: `${Math.max(2, Math.min(100, pct))}%` }} />
    </span>
  );
}
