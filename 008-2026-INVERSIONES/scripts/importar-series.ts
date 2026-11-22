/**
 * Importa el CSV de series oficiales (TRM, TPM, IBR_3M_EA, IPC_INDICE) que escriben los exportadores del Mac (fase C:
 * C2b, C2c y C2d). En producción lo correrá inv-cargar con el temporal del sobre (vía B, `cargar-prod.sh importar-series`:
 * lo cablea C3); en local:
 *   npx tsx scripts/importar-series.ts --archivo <series.csv>
 * Lee un archivo REGULAR con tope, valida el CSV entero ANTES de abrir la base (todo o nada; el adelanto se mide contra
 * hoy en Colombia) y guarda por el camino único (src/datos-oficiales/series/guardar.ts). Imprime conteos, códigos de
 * serie, fechas y códigos de error; nunca valores (src/datos-oficiales/series/importar.ts).
 * Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error. En producción, todo fallo termina
 * con «pare la carga y avise al CEO de 008».
 */
import { PrismaClient } from "@prisma/client";
import { leerArgumentosImportarSeries } from "../src/datos-oficiales/series/argumentos";
import { MAX_BYTES_CSV_SERIES, leerCsvSeries } from "../src/datos-oficiales/series/csv-series";
import {
  emitir, importarSeries, salidaArchivo, salidaCsvInvalido, salidaImportacion, salidaInesperada, salidaUso, type SalidaCliSeries,
} from "../src/datos-oficiales/series/importar";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";
import { ErrorArgumentosCarga } from "../src/precios/argumentos-carga";
import { fechaEnBogota } from "../src/precios/horario";

// La imagen del migrador trae NODE_ENV=production: allí los pasos son los de la vía B (cargar-prod.sh).
const opciones = { produccion: process.env.NODE_ENV === "production" };

function archivoDeLosArgumentos(): string | SalidaCliSeries {
  try {
    return leerArgumentosImportarSeries(process.argv.slice(2), process.env).archivo;
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    return salidaUso(e.message, opciones);
  }
}

async function main(): Promise<SalidaCliSeries> {
  const archivo = archivoDeLosArgumentos();
  if (typeof archivo !== "string") return archivo;
  const leido = leerArchivoAcotado(archivo, MAX_BYTES_CSV_SERIES);
  if (!leido.ok) return salidaArchivo(leido.codigo, opciones);
  const csv = leerCsvSeries(leido.bytes, fechaEnBogota(new Date()));
  if (!csv.ok) return salidaCsvInvalido(csv, opciones);
  const db = new PrismaClient();
  try {
    // Conectar primero: una base inalcanzable es un error (1), no un fallo por serie.
    await db.$connect();
    return salidaImportacion(await importarSeries(db, csv), opciones);
  } finally {
    await db.$disconnect();
  }
}

// exitCode y no exit(): en macOS stdout por tubería es asíncrono y exit() podría cortar la salida. El catch va después
// del then: también atrapa un fallo al cerrar la base o al escribir la salida.
main()
  .then((s) => {
    process.exitCode = emitir(s, console);
  })
  .catch((e: unknown) => {
    process.exitCode = emitir(salidaInesperada(e, opciones), console);
  });
