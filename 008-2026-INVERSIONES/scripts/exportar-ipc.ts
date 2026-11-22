/**
 * En el Mac, sin red ni base (fase C, C2d): lee el anexo de índices del IPC que el dueño baja del DANE y escribe por
 * stdout el CSV de series oficiales (IPC_INDICE) que `importar-series` carga (vía B, docs/despliegue/produccion.md §11):
 *   npx tsx scripts/exportar-ipc.ts --archivo <anex-IPC-Indices.xlsx> > <ipc.csv.parcial> && mv <ipc.csv.parcial> <ipc.csv>
 * - Solo con --archivo: la ruta del anexo en el DANE cambia cada mes. Solo el índice (P9): la variación la calcula 008.
 * - El zip y el XML se leen con los lectores acotados, a través de src/datos-oficiales/fuentes/dane-ipc.ts: por eso es
 *   un scripts/exportar-* (tests/unit/lib/lectores-candado.test.ts).
 * - Se niega a escribir en una terminal. A diferencia de fondo:exportar, no exige un archivo privado (SALIDA_NO_PRIVADA):
 *   el IPC es público y el CSV no dice nada del dueño.
 * - Por stderr solo conteos, meses, códigos y celdas; nunca valores ni la ruta.
 * Salida: 0 bien · 2 uso, terminal o anexo ilegible · 1 anexo rechazado o demasiado grande, o la salida se cerró.
 */
import {
  MAX_BYTES_ANEXO_IPC, SALIDA_CERRADA_IPC, SALIDA_TERMINAL_IPC, emitirIpc, exportarIpc, leerArgumentosExportarIpc, salidaArchivoIpc, salidaUsoIpc,
  type SalidaExportarIpc,
} from "../src/datos-oficiales/fuentes/dane-ipc";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";
import { ErrorArgumentosCarga } from "../src/precios/argumentos-carga";
import { escribirCompleto } from "../src/precios/exportar";
import { fechaEnBogota } from "../src/precios/horario";

function archivoDeLosArgumentos(): string | SalidaExportarIpc {
  try {
    return leerArgumentosExportarIpc(process.argv.slice(2), process.env).archivo;
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    return salidaUsoIpc(e.message);
  }
}

async function main(): Promise<number> {
  const archivo = archivoDeLosArgumentos();
  if (typeof archivo !== "string") return emitirIpc(archivo, console);
  if (process.stdout.isTTY) return emitirIpc(SALIDA_TERMINAL_IPC, console);
  const leido = leerArchivoAcotado(archivo, MAX_BYTES_ANEXO_IPC);
  if (!leido.ok) return emitirIpc(salidaArchivoIpc(leido.codigo), console);
  const s = exportarIpc(leido.bytes, fechaEnBogota(new Date()));
  if (s.csv !== null) {
    try {
      await escribirCompleto(process.stdout, s.csv);
    } catch {
      return emitirIpc(SALIDA_CERRADA_IPC, console);
    }
  }
  return emitirIpc(s, console);
}

// Sin process.exit(): el CSV termina de escribirse antes de que el proceso acabe (en macOS un tubo es asíncrono).
main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(`❌ La exportación del IPC falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
