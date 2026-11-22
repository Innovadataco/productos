/**
 * De dónde y de cuándo es un dato (frente fecha-hora-datos): una nota chica bajo la cifra con la fecha del dato, cuándo
 * lo trajo 008 (hora de Colombia) y la fuente; en un valor que suma varios datos, el más viejo y, si hay fechas
 * distintas, el aviso. Sin directiva ni hooks: lo pintan igual los componentes del servidor (plan, conciliación) y los
 * de cliente (el tablero). No es un control ni una región viva: sin role, sin enlaces, sin botones. Los textos salen de
 * las piezas de textos.ts; las fechas van en <time>.
 */
import "./fecha-dato.css";
import { piezasAviso, piezasCompuesta, piezasProcedencia, type OpcionesProcedencia, type Pieza } from "./textos";
import type { Procedencia, ProcedenciaCompuesta } from "./tipos";

function Piezas({ piezas }: { readonly piezas: readonly Pieza[] }) {
  // Las piezas son fijas para cada dato (no se reordenan): el índice sirve de clave.
  return <>{piezas.map((p, k) => (p.dateTime === undefined ? <span key={k}>{p.texto}</span> : <time key={k} dateTime={p.dateTime}>{p.texto}</time>))}</>;
}

interface PropsFechaDato extends OpcionesProcedencia {
  readonly procedencia: Procedencia;
  /** Dentro de una cuadrícula (las tarjetas de «Qué movió»): ocupa toda la fila. */
  readonly ancho?: boolean;
}

export function FechaDato({ procedencia, etiqueta, sinFecha, ancho = false }: PropsFechaDato) {
  return <span className={ancho ? "fecha-dato fecha-dato-ancho" : "fecha-dato"}><Piezas piezas={piezasProcedencia(procedencia, { etiqueta, sinFecha })} /></span>;
}

export function FechaDatoCompuesta({ compuesta }: { readonly compuesta: ProcedenciaCompuesta }) {
  const aviso = piezasAviso(compuesta);
  return (
    <span className="fecha-dato">
      <span className="fecha-dato-linea"><Piezas piezas={piezasCompuesta(compuesta)} /></span>
      {aviso === null ? null : <>{" "}<span className="fecha-dato-aviso"><Piezas piezas={aviso} /></span></>}
    </span>
  );
}
