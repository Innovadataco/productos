"use client";
/**
 * Los controles del simulador (frente proyecciones-pantalla): horizonte (1, 3, 5 y 10 años y un ajuste fino de mes en
 * mes), aporte periódico y su frecuencia, reinvertir los dividendos y caída inicial. Cada uno con su etiqueta, usable
 * con el teclado y con el dedo (≥ 44 px, proyecciones.css). Lo que se mueve no se guarda: ni en el navegador ni en la
 * URL. El valor de cada deslizador se lee en palabras (aria-valuetext); la cifra a la vista es decorativa.
 */
import { useId, useState, type CSSProperties } from "react";
import { Selector } from "@/app/_graficas";
import { cop } from "@/app/tablero/formato";
import type { Frecuencia } from "@/proyecciones/tipos";
import {
  APORTE_MAX, CAIDA_MAX_PANTALLA, HORIZONTES, HORIZONTE_MAX_MESES, HORIZONTE_MIN_MESES, OPCIONES_FRECUENCIA, aporteDeTexto, enRango, textoHorizonte, type Controles as ValoresControles,
} from "./opciones";

interface Props {
  readonly controles: ValoresControles;
  readonly alCambiar: (cambio: Partial<ValoresControles>) => void;
  readonly alReiniciar: () => void;
}

const OPCIONES_HORIZONTE = HORIZONTES.map((h) => ({ clave: String(h.meses), texto: h.texto, disponible: true }));
const OPCIONES_FREC = OPCIONES_FRECUENCIA.map((o) => ({ ...o, disponible: true }));
/** En palabras, como la cifra a la vista. */
const textoCaida = (v: number) => (v === 0 ? "sin caída" : `caída de ${v} %`);
/** El tramo recorrido del deslizador, para pintar su pista (WebKit no tiene «progreso»; Firefox sí). */
const relleno = (v: number, minimo: number, maximo: number): CSSProperties =>
  ({ ["--relleno" as string]: `${Math.round(((v - minimo) / (maximo - minimo)) * 1000) / 10}%` });

/** Lo que se escribió en el aporte no siempre es lo que viaja: si se corrige, se dice (WCAG 3.3.1). */
function avisoAporte(texto: string): string {
  if (texto.trim() === "") return "";
  const v = Number(texto);
  if (!Number.isFinite(v) || v < 0) return "Ese valor no sirve como aporte: se calcula sin aportes.";
  return v > APORTE_MAX ? `Pasa del tope: se calcula con ${cop(APORTE_MAX)}.` : "";
}

export function Controles({ controles: c, alCambiar, alReiniciar }: Props) {
  const base = useId();
  const id = (s: string) => `${base}-${s}`;
  // El texto del aporte es local (se puede escribir «41.» a medias); lo que viaja es el número del borde.
  const [aporte, setAporte] = useState(c.aportePeriodico === 0 ? "" : String(c.aportePeriodico));
  const reiniciar = () => {
    setAporte("");
    alReiniciar();
  };
  return (
    <form className="proy-controles" aria-labelledby={id("t")} onSubmit={(e) => e.preventDefault()}>
      <div className="proy-controles-cabeza">
        <h2 id={id("t")}>Controles</h2>
        <button type="button" className="proy-reiniciar" onClick={reiniciar}>Valores iniciales</button>
      </div>

      <fieldset className="proy-campo">
        <legend>Plazo</legend>
        <Selector etiqueta="Horizonte" opciones={OPCIONES_HORIZONTE} valor={String(c.horizonteMeses)} alCambiar={(k) => alCambiar({ horizonteMeses: Number(k) })} />
        <label htmlFor={id("h")} className="proy-etiqueta-fila">
          Ajuste fino del horizonte <span className="proy-valor" aria-hidden="true">{textoHorizonte(c.horizonteMeses)}</span>
        </label>
        <input
          id={id("h")} className="proy-rango" type="range" min={HORIZONTE_MIN_MESES} max={HORIZONTE_MAX_MESES} step={1} value={c.horizonteMeses}
          aria-valuetext={textoHorizonte(c.horizonteMeses)} style={relleno(c.horizonteMeses, HORIZONTE_MIN_MESES, HORIZONTE_MAX_MESES)}
          onChange={(e) => alCambiar({ horizonteMeses: enRango(Number(e.target.value), HORIZONTE_MIN_MESES, HORIZONTE_MAX_MESES) })}
        />
      </fieldset>

      <fieldset className="proy-campo">
        <legend>Aportes</legend>
        <label htmlFor={id("a")}>Aporte periódico (pesos)</label>
        <input
          id={id("a")} type="number" inputMode="decimal" min={0} step="any" placeholder="0" value={aporte} aria-describedby={`${id("a-ayuda")} ${id("a-aviso")}`}
          onChange={(e) => {
            setAporte(e.target.value);
            alCambiar({ aportePeriodico: aporteDeTexto(e.target.value) });
          }}
        />
        <span id={id("a-ayuda")} className="proy-ayuda">Al final de cada periodo, repartido con los pesos de hoy. En 0, sin aportes.</span>
        <span id={id("a-aviso")} className="proy-ayuda proy-corregido">{avisoAporte(aporte)}</span>
        <Selector<Frecuencia> etiqueta="Frecuencia del aporte" opciones={OPCIONES_FREC} valor={c.frecuenciaAporte} alCambiar={(f) => alCambiar({ frecuenciaAporte: f })} />
      </fieldset>

      <fieldset className="proy-campo">
        <legend>Dividendos y caída</legend>
        <div className="proy-fila-interruptor">
          <input
            id={id("r")} className="proy-interruptor" type="checkbox" role="switch" checked={c.reinvertirDividendos} aria-describedby={id("r-ayuda")}
            onChange={(e) => alCambiar({ reinvertirDividendos: e.target.checked })}
          />
          <label htmlFor={id("r")}>Reinvertir los dividendos</label>
        </div>
        <span id={id("r-ayuda")} className="proy-ayuda">
          {c.reinvertirDividendos ? "Se reinvierten en la misma especie el día que se cobran." : "Se cobran: salen del valor y se suman aparte."}
        </span>
        <label htmlFor={id("c")} className="proy-etiqueta-fila">
          Caída inicial <span className="proy-valor" aria-hidden="true">{c.caidaInicialPct === 0 ? "sin caída" : `−${c.caidaInicialPct} %`}</span>
        </label>
        <input
          id={id("c")} className="proy-rango" type="range" min={0} max={CAIDA_MAX_PANTALLA} step={1} value={c.caidaInicialPct} aria-describedby={id("c-ayuda")}
          aria-valuetext={textoCaida(c.caidaInicialPct)} style={relleno(c.caidaInicialPct, 0, CAIDA_MAX_PANTALLA)}
          onChange={(e) => alCambiar({ caidaInicialPct: enRango(Number(e.target.value), 0, CAIDA_MAX_PANTALLA) })}
        />
        <span id={id("c-ayuda")} className="proy-ayuda">Todas las posiciones caen hoy ese porcentaje, también el fondo.</span>
      </fieldset>
    </form>
  );
}
