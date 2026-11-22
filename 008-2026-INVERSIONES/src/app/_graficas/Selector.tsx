"use client";
/** Una fila de botones con aria-pressed (el rango de fechas): lo que la historia no cubre va deshabilitado. */
import type { PropsSelector } from "./tipos";

export function Selector<K extends string>({ etiqueta, opciones, valor, alCambiar }: PropsSelector<K>) {
  return (
    <div role="group" aria-label={etiqueta} className="g-selector">
      {opciones.map((o) => (
        <button key={o.clave} type="button" className="pill" aria-pressed={o.clave === valor} disabled={!o.disponible} onClick={() => alCambiar(o.clave)}>
          {o.texto}
        </button>
      ))}
    </div>
  );
}
