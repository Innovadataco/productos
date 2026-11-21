/**
 * Importa el CSV de valores de unidad del fondo que escribió `fondo:exportar` en el Mac (vía B,
 * docs/despliegue/produccion.md §11). En producción lo corre inv-cargar con el temporal del sobre
 * (`cargar-prod.sh importar-valores-fondo`); en local:
 *   npm run -s fondo:importar -- --archivo <valores-fondo.csv>
 * Lee un archivo REGULAR con tope, valida el CSV entero ANTES de abrir la base (todo o nada) y guarda por el mismo
 * camino que actualizar-fondo (src/fondo/guardar.ts). Imprime conteos, códigos, números de línea, ids internos y
 * fechas; nunca el código del fondo, su clase ni valores. Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible ·
 * 1 CSV rechazado o error.
 */
import { PrismaClient } from "@prisma/client";
import { ErrorArgumentosCarga } from "../src/precios/argumentos-carga";
import { fechaEnBogota } from "../src/precios/horario";
import { reporteErroresCsv } from "../src/precios/reporte";
import { USO_IMPORTAR_VALORES_FONDO, leerArgumentosImportarValoresFondo } from "../src/fondo/argumentos-carga";
import { MAX_BYTES_CSV_FONDO, leerCsvValoresFondo } from "../src/fondo/csv-valores";
import { importarValoresFondo } from "../src/fondo/importar";
import { reporteImportacionFondo } from "../src/fondo/reporte";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";

const DEMASIADO_GRANDE = `❌ CSV_DEMASIADO_GRANDE · el archivo pasa de ${MAX_BYTES_CSV_FONDO} bytes; no se guardó nada.`;

async function main(): Promise<number> {
  let archivo: string;
  try {
    archivo = leerArgumentosImportarValoresFondo(process.argv.slice(2), process.env).archivo;
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    console.error(`❌ ${e.message}\n${USO_IMPORTAR_VALORES_FONDO}`);
    return 2;
  }
  const leido = leerArchivoAcotado(archivo, MAX_BYTES_CSV_FONDO);
  if (!leido.ok && leido.codigo === "ARCHIVO_DEMASIADO_GRANDE") {
    console.error(DEMASIADO_GRANDE);
    return 1;
  }
  if (!leido.ok) {
    console.error(`❌ ${leido.codigo} · no se pudo leer el CSV indicado (debe ser un archivo regular); no se tocó la base.`);
    return 2;
  }
  const ahora = new Date();
  const csv = leerCsvValoresFondo(leido.bytes, fechaEnBogota(ahora));
  if (!csv.ok) {
    for (const linea of csv.codigo === "CSV_DEMASIADO_GRANDE" ? [DEMASIADO_GRANDE] : reporteErroresCsv(csv)) console.error(linea);
    return 1;
  }
  const db = new PrismaClient();
  try {
    const reporte = reporteImportacionFondo(await importarValoresFondo(db, csv, { ahora }));
    for (const linea of reporte.lineas) console.log(linea);
    return reporte.codigoSalida;
  } finally {
    await db.$disconnect();
  }
}

// Sin process.exit(): la salida termina de escribirse antes de que el proceso acabe.
main()
  .then((codigo) => {
    process.exitCode = codigo;
  })
  .catch((e: unknown) => {
    console.error(`❌ La importación de valores del fondo falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
