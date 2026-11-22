"use client";
/**
 * Una fila de botones con aria-pressed (el rango de fechas). Lo que la historia no cubre queda aria-disabled (sigue
 * enfocable, no hace nada) y dice por qué con su `nota`.
 */
import { Fragment, useId } from "react";
import { idSeguro } from "./ids";
import type { PropsSelector } from "./tipos";

export function Selector<K extends string>({ etiqueta, opciones, valor, alCambiar }: PropsSelector<K>) {
  const base = idSeguro(useId());
  return (
    <div role="group" aria-label={etiqueta} className="g-selector">
      {opciones.map((o) => {
        const idNota = !o.disponible && o.nota ? `${base}-${o.clave}` : undefined;
        return (
          <Fragment key={o.clave}>
            <button
              type="button" className="g-opcion" aria-pressed={o.clave === valor} aria-disabled={o.disponible ? undefined : true} aria-describedby={idNota}
              onClick={() => { if (o.disponible) alCambiar(o.clave); }}
            >{o.texto}</button>
            {idNota ? <span id={idNota} className="g-sr">{o.nota}</span> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
