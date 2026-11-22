/**
 * La mira de la gráfica de tiempo: qué día se señala, por puntero (se pega al día más cercano; con el dedo se queda
 * al soltar) o por teclado (la capa es un deslizador: ←/→ y ↓/↑, Inicio/Fin, RePág/AvPág; Escape la quita).
 * El estado es solo el índice: mover el puntero dentro del mismo día no vuelve a pintar nada.
 */
import { useState, type KeyboardEvent, type PointerEvent } from "react";
import type { Escala } from "./escalas";
import { ANCHO } from "./geometria";
import { indiceCercano, indiceTrasTecla } from "./interaccion";
import type { Ventana } from "./tipos";

export interface Manejadores {
  readonly onPointerMove: (ev: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (ev: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerLeave: (ev: PointerEvent<HTMLDivElement>) => void;
  readonly onKeyDown: (ev: KeyboardEvent<HTMLDivElement>) => void;
  readonly onFocus: () => void;
  readonly onBlur: () => void;
}

export function useMira(xs: readonly number[], v: Ventana, x: Escala): { readonly activo: number | null; readonly manejadores: Manejadores } {
  const [mira, setMira] = useState<number | null>(null);
  const activo = mira !== null && mira >= v.desde && mira <= v.hasta ? mira : null;
  const alPuntero = (ev: PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    setMira(indiceCercano(xs, x.de(((ev.clientX - r.left) / r.width) * ANCHO), v));
  };
  const manejadores: Manejadores = {
    onPointerMove: alPuntero,
    onPointerDown: alPuntero,
    onPointerLeave: (ev) => { if (ev.pointerType !== "touch") setMira(null); },
    onKeyDown: (ev) => {
      if (ev.key === "Escape") { setMira(null); return; }
      const i = indiceTrasTecla(ev.key, activo, v);
      if (i === null) return;
      ev.preventDefault();
      setMira(i);
    },
    onFocus: () => { if (activo === null) setMira(v.hasta); },
    onBlur: () => setMira(null),
  };
  return { activo, manejadores };
}
