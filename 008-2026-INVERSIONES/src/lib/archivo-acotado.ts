/**
 * Lectura acotada de un archivo REGULAR para los CLI que reciben un archivo (precios:importar, precios:exportar y la
 * certificación de A&V). Solo la usan scripts/: nunca la app (tests/unit/produccion/sin-lecturas-dinamicas.test.ts).
 * - Se abre con O_NONBLOCK: un FIFO sin escritor no cuelga el open(). En un archivo regular no cambia nada.
 * - El tipo se mira sobre el descriptor ya abierto (fstat), no sobre la ruta: un FIFO, un dispositivo o una carpeta
 *   no pasan, y no hay carrera entre mirar y abrir.
 * - Nunca se lee más de `tope` + 1 bytes: lo que pasa del tope se rechaza sin leerlo entero.
 * - Los fallos vuelven como código, nunca con la ruta ni el mensaje del sistema.
 */
import { closeSync, constants, fstatSync, openSync, readSync, type Stats } from "node:fs";

export type ResultadoArchivo =
  | { readonly ok: true; readonly bytes: Uint8Array }
  | { readonly ok: false; readonly codigo: "ARCHIVO_ILEGIBLE" | "ARCHIVO_NO_REGULAR" | "ARCHIVO_DEMASIADO_GRANDE" };

function abrir(ruta: string): number | null {
  try {
    return openSync(ruta, constants.O_RDONLY | constants.O_NONBLOCK);
  } catch {
    return null;
  }
}

function tipoDe(fd: number): Stats | null {
  try {
    return fstatSync(fd);
  } catch {
    return null;
  }
}

/** Lee hasta `tope` + 1 bytes del descriptor; null si la lectura falla. */
function leerHasta(fd: number, tope: number): Uint8Array | null {
  const buffer = Buffer.alloc(tope + 1);
  let leidos = 0;
  try {
    for (let n = 1; n > 0 && leidos < buffer.length; leidos += n) n = readSync(fd, buffer, leidos, buffer.length - leidos, null);
  } catch {
    return null;
  }
  return new Uint8Array(buffer.subarray(0, leidos));
}

export function leerArchivoAcotado(ruta: string, tope: number): ResultadoArchivo {
  const fd = abrir(ruta);
  if (fd === null) return { ok: false, codigo: "ARCHIVO_ILEGIBLE" };
  try {
    const info = tipoDe(fd);
    if (info === null) return { ok: false, codigo: "ARCHIVO_ILEGIBLE" };
    if (!info.isFile()) return { ok: false, codigo: "ARCHIVO_NO_REGULAR" };
    if (info.size > tope) return { ok: false, codigo: "ARCHIVO_DEMASIADO_GRANDE" };
    const bytes = leerHasta(fd, tope);
    if (bytes === null) return { ok: false, codigo: "ARCHIVO_ILEGIBLE" };
    return bytes.length > tope ? { ok: false, codigo: "ARCHIVO_DEMASIADO_GRANDE" } : { ok: true, bytes };
  } finally {
    closeSync(fd);
  }
}
