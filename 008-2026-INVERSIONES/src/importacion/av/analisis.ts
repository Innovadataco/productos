/**
 * Del PDF a la certificación interpretada, sin tocar la base: lector → tabla → filas → posiciones por especie →
 * registros con su clave natural. Todo error sale como `ErrorFilaAv` (código y ubicación, nunca texto).
 */
import { agregarPosiciones, type PosicionAgregada } from "./agregar";
import { asignarClavesAv, registrosDe, type RegistroAvConClave } from "./clave";
import { interpretarFilas, type CertificacionLeida, type ErrorFilaAv } from "./filas";
import { ErrorPdf } from "./pdf/errores";
import { extraerLineas } from "./pdf/lector";
import { ErrorTabla, leerTablaCertificacion } from "./tabla";

export interface CertificacionAnalizada {
  readonly creadoEn: Date | null;
  readonly leida: CertificacionLeida;
  readonly posiciones: readonly PosicionAgregada[];
  readonly registros: readonly RegistroAvConClave[];
}

export type Analisis = { readonly ok: true; readonly valor: CertificacionAnalizada } | { readonly ok: false; readonly errores: ErrorFilaAv[] };

/** Un error del documento entero (sin página ni fila). */
export const errorDeDocumento = (codigo: string): ErrorFilaAv => ({ pagina: 0, fila: 0, columna: null, codigo });
const documento = errorDeDocumento;

function leerTabla(bytes: Uint8Array): { ok: true; creadoEn: Date | null; filas: ReturnType<typeof leerTablaCertificacion> } | { ok: false; errores: ErrorFilaAv[] } {
  try {
    const lectura = extraerLineas(bytes);
    return { ok: true, creadoEn: lectura.creadoEn, filas: leerTablaCertificacion(lectura) };
  } catch (e) {
    if (e instanceof ErrorPdf) return { ok: false, errores: [documento(e.codigo)] };
    if (e instanceof ErrorTabla) return { ok: false, errores: [{ pagina: e.pagina, fila: e.linea, columna: null, codigo: e.codigo }] };
    throw e;
  }
}

/** `fechaCorte` en AAAA-MM-DD: va en la clave natural de cada fila. */
export function analizarCertificacion(bytes: Uint8Array, fechaCorte: string): Analisis {
  const tabla = leerTabla(bytes);
  if (!tabla.ok) return tabla;
  const filas = interpretarFilas(tabla.filas);
  if (!filas.ok) return filas;
  const posiciones = agregarPosiciones(filas.valor.lotes);
  if (!posiciones.ok) return posiciones;
  const registros = asignarClavesAv(fechaCorte, registrosDe(filas.valor));
  return { ok: true, valor: { creadoEn: tabla.creadoEn, leida: filas.valor, posiciones: posiciones.valor, registros } };
}
