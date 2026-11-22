"use client";
/**
 * Barras horizontales divergentes (frente graficas-tablero): cada una crece desde el cero (a la derecha si es
 * positiva, a la izquierda si es negativa), con su valor en texto en la punta y su detalle debajo. Si hay
 * `alElegir`, cada fila es un botón que lleva al origen de la cifra. Crecen al entrar en pantalla.
 */
import { useId } from "react";
import { useHidratado, useVisible } from "./animacion";
import { barrasDivergentes } from "./escalas";
import { idSeguro } from "./ids";
import type { FilaBarra, PropsBarras } from "./tipos";

/** El detalle se parte solo entre sus piezas « · » (una fecha como «1-nov-2024» nunca queda cortada). */
const partes = (detalle: string) =>
  detalle.split(" · ").map((p, k) => <span key={k}>{k > 0 ? " · " : null}<span className="g-sin-corte">{p}</span></span>);

function Contenido({ f, izquierda, ancho, cero }: { readonly f: FilaBarra; readonly izquierda: number; readonly ancho: number; readonly cero: number }) {
  const signo = f.valor >= 0 ? "gana" : "pierde";
  return (
    <>
      <span className="g-barra-nombre">{f.nombre}</span>{" "}
      <span className="g-barra-pista" aria-hidden="true">
        <span className="g-barra-cero" style={{ left: `${cero}%` }} />
        <span className={`g-barra-relleno t-${signo}`} data-signo={signo} style={{ left: `${izquierda}%`, width: `${ancho}%` }} />
      </span>
      <span className="g-barra-valor">{f.texto}</span>
      {f.detalle ? <>{" "}<span className="g-barra-detalle">{partes(f.detalle)}</span></> : null}
    </>
  );
}

export function Barras({ titulo, resumen, filas, alElegir }: PropsBarras) {
  const base = idSeguro(useId());
  const { ref, visible } = useVisible<HTMLUListElement>();
  const hidratado = useHidratado();
  const geo = barrasDivergentes(filas.map((f) => f.valor));
  return (
    <figure className="g-figura g-barras-figura" aria-labelledby={`${base}-t`} aria-describedby={`${base}-r`}>
      <figcaption className="g-cabeza"><span className="g-titulo" id={`${base}-t`}>{titulo}</span></figcaption>
      <p id={`${base}-r`} className="sr">{resumen}</p>
      {filas.length === 0 ? <p className="nota">Sin especies con rentabilidad para mostrar.</p> : (
        <ul className="g-barras" ref={ref} data-visible={visible ? "" : undefined} data-hidratado={hidratado ? "" : undefined}>
          {filas.map((f, k) => {
            const g = geo.barras[k]!;
            const contenido = <Contenido f={f} izquierda={g.izquierda} ancho={g.ancho} cero={geo.cero} />;
            return (
              <li key={f.id}>
                {alElegir
                  ? <button type="button" className="g-barra" onClick={(e) => alElegir(f.id, e.currentTarget)}>{contenido}</button>
                  : <div className="g-barra">{contenido}</div>}
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}
