/**
 * Lo que imprimen los CLI del registro del dueño (fase C: decretos, C4a): código de salida, líneas por stdout y errores
 * por stderr. Puro; `emitir` escribe. Nunca valores, especies, el correo ni el mensaje de un error (el de Prisma lleva el
 * host de la base o valores de la fila): solo códigos, números de línea, conteos e ids internos.
 *   0 bien · 1 error de la base, del cifrado o inesperado · 2 uso o archivo ilegible · 3 rechazado (no escribió nada).
 * En producción (NODE_ENV=production, la imagen del migrador: vía B, §11 del runbook) toda salida distinta de 0 termina
 * con PARE_VIA_B.
 */
import { ErrorCifrado } from "../../cifrado/errores";
import { PARE_VIA_B } from "../../cli/via-b";
import { detalleDeError } from "../../precios/guardar";
import type { Hallazgo } from "./hallazgos";

export interface OpcionesSalida {
  /** NODE_ENV=production: el CLI corre por la vía B (cargar-prod.sh → inv-cargar). */
  readonly produccion: boolean;
}

export type CodigoSalida = 0 | 1 | 2 | 3;

export interface SalidaCli {
  readonly codigoSalida: CodigoSalida;
  /** Por stdout. */
  readonly lineas: readonly string[];
  /** Por stderr. */
  readonly errores: readonly string[];
}

export interface Consola {
  readonly log: (linea: string) => void;
  readonly error: (linea: string) => void;
}

export const bien = (lineas: readonly string[]): SalidaCli => ({ codigoSalida: 0, lineas, errores: [] });

/** Un fallo: `textos` por stderr y, en producción, al final la frase de parar la carga. */
export function fallo(o: OpcionesSalida, codigoSalida: Exclude<CodigoSalida, 0>, textos: readonly string[], lineas: readonly string[] = []): SalidaCli {
  return { codigoSalida, lineas, errores: o.produccion ? [...textos, PARE_VIA_B] : textos };
}

const donde = (h: Hallazgo): string => (h.linea === 0 ? "todo el archivo" : `línea ${h.linea}`);

/** Un renglón por hallazgo (línea · columna · código) y, si se recortaron, cuántos más hubo. */
export function lineasHallazgos(hallazgos: readonly Hallazgo[], total: number): string[] {
  const lineas = hallazgos.map((h) => `   ${donde(h)}${h.columna ? ` · ${h.columna}` : ""} · ${h.codigo}`);
  return total > hallazgos.length ? [...lineas, `   … y ${total - hallazgos.length} más`] : lineas;
}

/**
 * El error que sube hasta el CLI: su clase y su código, nunca su mensaje. Un ErrorCifrado ocurre antes de escribir o
 * deshace la transacción: no se escribió nada. Cualquier otro pudo ocurrir al confirmar: no se promete nada.
 */
export function salidaError(e: unknown, o: OpcionesSalida): SalidaCli {
  if (e instanceof ErrorCifrado) return fallo(o, 1, [`❌ ErrorCifrado ${e.codigo} · revise las claves de cifrado del entorno; no se escribió nada.`]);
  return fallo(o, 1, [`❌ Error (${detalleDeError(e)}). No se pudo confirmar si se escribió algo${o.produccion ? "." : ": revíselo antes de repetir."}`]);
}

/** Escribe las líneas (stdout) y los errores (stderr), en ese orden, y devuelve el código de salida. */
export function emitir(s: SalidaCli, consola: Consola): number {
  for (const linea of s.lineas) consola.log(linea);
  for (const linea of s.errores) consola.error(linea);
  return s.codigoSalida;
}
