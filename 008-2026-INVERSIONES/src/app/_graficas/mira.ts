/**
 * La mira de la gráfica de tiempo: qué día se señala, por puntero (se pega al día más cercano; con el dedo se queda
 * al soltar) o por teclado (←/→, Inicio/Fin, RePág/AvPág, Escape), y si hay que anunciarlo (solo con el teclado).
 */
import { useState, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import type { Escala } from "./escalas";
import { ANCHO } from "./geometria";
import { indiceCercano, indiceTrasTecla } from "./interaccion";
import type { Ventana } from "./tipos";

interface Mira { readonly indice: number; readonly anunciar: boolean }

export interface Manejadores {
  readonly onPointerMove: (ev: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerDown: (ev: PointerEvent<HTMLDivElement>) => void;
  readonly onPointerLeave: (ev: PointerEvent<HTMLDivElement>) => void;
  readonly onKeyDown: (ev: KeyboardEvent<HTMLDivElement>) => void;
  readonly onFocus: (ev: FocusEvent<HTMLDivElement>) => void;
  readonly onBlur: (ev: FocusEvent<HTMLDivElement>) => void;
}

export function useMira(xs: readonly number[], v: Ventana, x: Escala): { readonly activo: number | null; readonly anunciar: boolean; readonly manejadores: Manejadores } {
  const [mira, setMira] = useState<Mira | null>(null);
  const activo = mira !== null && mira.indice >= v.desde && mira.indice <= v.hasta ? mira.indice : null;
  const alPuntero = (ev: PointerEvent<HTMLDivElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    if (r.width <= 0) return;
    setMira({ indice: indiceCercano(xs, x.de(((ev.clientX - r.left) / r.width) * ANCHO), v), anunciar: false });
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
      setMira({ indice: i, anunciar: true });
    },
    onFocus: () => { if (activo === null) setMira({ indice: v.hasta, anunciar: true }); },
    onBlur: () => setMira(null),
  };
  return { activo, anunciar: mira?.anunciar === true && activo !== null, manejadores };
}
