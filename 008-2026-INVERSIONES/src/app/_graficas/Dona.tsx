"use client";
/**
 * Dona de composición (frente graficas-tablero): tajadas con un hueco del color del panel, el total al centro y, al
 * marcar una tajada (en el dibujo o en la leyenda, con puntero o foco), su nombre, valor y porcentaje. La leyenda
 * lleva siempre las cifras (la identidad nunca depende solo del color) y, si hay `alElegir`, cada tajada elegible
 * es un botón que lleva a su detalle. Las tajadas se dibujan al entrar en pantalla.
 */
import { useId, useRef, useState } from "react";
import { useHidratado, useVisible } from "./animacion";
import { idSeguro } from "./ids";
import { tajadasDona } from "./trazos";
import type { PropsDona, Segmento, Tono } from "./tipos";

const LADO = 200;
const RADIO = 80;
const GROSOR = 26;
const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
/** Hueco entre tajadas (unidades del dibujo ≈ px a su tamaño normal). */
const HUECO = 3;
const RETRASO_MS = 70;

const tonoDe = (s: Segmento, k: number): Tono => s.tono ?? (`c${Math.min(8, k + 1)}` as Tono);

function Centro({ activo, centro }: { readonly activo: Segmento | null; readonly centro: PropsDona["centro"] }) {
  return (
    <div className="g-centro" aria-hidden="true">
      {activo
        ? <><span className="g-centro-etiqueta">{activo.nombre}</span> <b>{activo.textoValor}</b> <span>{activo.textoPct}</span></>
        : <><span className="g-centro-etiqueta">{centro.etiqueta}</span> <b>{centro.texto}</b></>}
    </div>
  );
}

export function Dona({ titulo, resumen, segmentos, centro, alElegir }: PropsDona) {
  const base = idSeguro(useId());
  const { ref, visible } = useVisible<HTMLDivElement>();
  const hidratado = useHidratado();
  const [activoId, setActivoId] = useState<string | null>(null);
  const botones = useRef(new Map<string, HTMLButtonElement>());
  const tajadas = tajadasDona(segmentos.map((s) => s.valor), CIRCUNFERENCIA, HUECO);
  const activo = segmentos.find((s) => s.id === activoId) ?? null;
  const elegible = (s: Segmento) => alElegir !== undefined && s.elegible !== false;
  const elegir = (s: Segmento) => {
    const origen = botones.current.get(s.id);
    if (elegible(s) && origen) alElegir!(s.id, origen);
  };
  const marcar = (id: string | null) => () => setActivoId(id);

  return (
    <figure className="g-figura g-dona" aria-labelledby={`${base}-t`} aria-describedby={`${base}-r`}>
      <figcaption className="g-cabeza"><span className="g-titulo" id={`${base}-t`}>{titulo}</span></figcaption>
      <p id={`${base}-r`} className="sr">{resumen}</p>
      {segmentos.length === 0 ? <p className="nota">Sin valores para repartir.</p> : (
        <div className="g-dona-cuerpo">
          <div className="g-dona-dibujo" ref={ref} data-visible={visible ? "" : undefined} data-hidratado={hidratado ? "" : undefined}>
            <svg viewBox={`0 0 ${LADO} ${LADO}`} aria-hidden="true" focusable="false">
              <circle className="g-dona-pista" cx={LADO / 2} cy={LADO / 2} r={RADIO} strokeWidth={GROSOR} />
              {segmentos.map((s, k) => {
                const t = tajadas[k]!;
                return (
                  <circle
                    key={s.id} data-id={s.id} className={`g-tajada t-${tonoDe(s, k)}`} data-activo={activoId === s.id ? "" : undefined}
                    cx={LADO / 2} cy={LADO / 2} r={RADIO} strokeWidth={GROSOR} transform={`rotate(-90 ${LADO / 2} ${LADO / 2})`}
                    style={{
                      strokeDasharray: visible ? `${t.largo} ${Math.round((CIRCUNFERENCIA - t.largo) * 10) / 10}` : `0 ${Math.round(CIRCUNFERENCIA * 10) / 10}`,
                      strokeDashoffset: `${-t.inicio}`, transitionDelay: `${k * RETRASO_MS}ms`,
                    }}
                    onPointerEnter={marcar(s.id)} onPointerLeave={marcar(null)} onClick={() => elegir(s)}
                  />
                );
              })}
            </svg>
            <Centro activo={activo} centro={centro} />
          </div>
          <ul className="g-leyenda-dona">
            {segmentos.map((s, k) => {
              const contenido = (
                <>
                  <i className={`g-clave-caja t-${tonoDe(s, k)}`} aria-hidden="true" />
                  <span className="g-item-nombre">{s.nombre}</span> <b>{s.textoValor}</b> <span className="g-item-pct">{s.textoPct}</span>
                  {s.detalle ? <span className="g-item-detalle"> {s.detalle}</span> : null}
                </>
              );
              return (
                <li key={s.id} data-activo={activoId === s.id ? "" : undefined} onPointerEnter={marcar(s.id)} onPointerLeave={marcar(null)}>
                  {elegible(s) ? (
                    <button
                      type="button" className="g-item" ref={(el) => { if (el) botones.current.set(s.id, el); else botones.current.delete(s.id); }}
                      onFocus={marcar(s.id)} onBlur={marcar(null)} onClick={() => elegir(s)}
                    >{contenido}<span className="sr"> (ver el detalle)</span></button>
                  ) : <span className="g-item">{contenido}</span>}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </figure>
  );
}
