/**
 * De dónde y de cuándo es un dato (frentes fecha-hora-datos y fuente-retraso): una nota chica bajo la cifra con el tipo
 * y la fecha del dato, cuándo lo trajo 008 (hora de Colombia) y la fuente con su nombre claro; en un valor que suma
 * varios datos, el más viejo y, si hay fechas distintas, el aviso. Si el cierre lleva más de un día hábil sin
 * renovarse, lo avisa. El detalle de la fuente y su retraso va en un texto del documento, oculto a la vista pero no al
 * lector de pantalla (no en un tooltip que solo se vea con el ratón). Sin directiva ni hooks: lo pintan igual los
 * componentes del servidor (plan, conciliación) y los de cliente (el tablero). No es un control ni una región viva: sin
 * role, sin enlaces, sin botones. Los textos salen de las piezas de textos.ts; las fechas y horas van en <time>.
 */
import "./fecha-dato.css";
import {
  avisoAtraso, detalleCompuesta, detalleProcedencia, piezasAviso, piezasCompuesta, piezasProcedencia, type OpcionesProcedencia, type Pieza,
} from "./textos";
import type { Procedencia, ProcedenciaCompuesta } from "./tipos";

function Piezas({ piezas }: { readonly piezas: readonly Pieza[] }) {
  // Las piezas son fijas para cada dato (no se reordenan): el índice sirve de clave.
  return <>{piezas.map((p, k) => (p.dateTime === undefined ? <span key={k}>{p.texto}</span> : <time key={k} dateTime={p.dateTime}>{p.texto}</time>))}</>;
}

/** El detalle accesible, tras un espacio para que el texto plano no lo pegue a la línea. */
const Detalle = ({ texto }: { readonly texto: string }) => <>{" "}<span className="fecha-dato-detalle">{texto}</span></>;

function Atraso({ p }: { readonly p: Procedencia }) {
  const aviso = avisoAtraso(p);
  return aviso === null ? null : <>{" "}<span className="fecha-dato-aviso">{aviso}</span></>;
}

interface PropsFechaDato extends OpcionesProcedencia {
  readonly procedencia: Procedencia;
  /** Dentro de una cuadrícula (las tarjetas de «Qué movió»): ocupa toda la fila. */
  readonly ancho?: boolean;
}

export function FechaDato({ procedencia, etiqueta, sinFecha, ancho = false }: PropsFechaDato) {
  return (
    <span className={ancho ? "fecha-dato fecha-dato-ancho" : "fecha-dato"}>
      <span className="fecha-dato-linea"><Piezas piezas={piezasProcedencia(procedencia, { etiqueta, sinFecha })} /></span>
      <Atraso p={procedencia} />
      <Detalle texto={detalleProcedencia(procedencia)} />
    </span>
  );
}

export function FechaDatoCompuesta({ compuesta }: { readonly compuesta: ProcedenciaCompuesta }) {
  const aviso = piezasAviso(compuesta);
  return (
    <span className="fecha-dato">
      <span className="fecha-dato-linea"><Piezas piezas={piezasCompuesta(compuesta)} /></span>
      {aviso === null ? null : <>{" "}<span className="fecha-dato-aviso"><Piezas piezas={aviso} /></span></>}
      <Atraso p={compuesta.masVieja} />
      <Detalle texto={detalleCompuesta(compuesta)} />
    </span>
  );
}
