/**
 * Importa el CSV de cierres públicos que escribió `precios:exportar` en el Mac (vía B, docs/despliegue/produccion.md
 * §11). En producción lo corre inv-cargar con el temporal del sobre; en local:
 *   npm run -s precios:importar -- --archivo <cierres.csv>
 * Lee un archivo REGULAR con tope, valida el CSV entero ANTES de abrir la base (todo o nada) y guarda por el mismo
 * camino que precios:actualizar (src/precios/guardar.ts). Imprime conteos, códigos, números de línea e ids internos;
 * nunca nemotécnicos ni precios. Salida: 0 bien · 3 con avisos · 2 uso o archivo ilegible · 1 CSV rechazado o error.
 */
import { PrismaClient } from "@prisma/client";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";
import { ErrorArgumentosCarga, USO_IMPORTAR_PRECIOS, leerArgumentosImportarPrecios } from "../src/precios/argumentos-carga";
import { MAX_BYTES_CSV, leerCsvCierres } from "../src/precios/csv-cierres";
import { importarPrecios } from "../src/precios/importar";
import { reporteErroresCsv, reporteImportacion } from "../src/precios/reporte";

const DEMASIADO_GRANDE = `❌ CSV_DEMASIADO_GRANDE · el archivo pasa de ${MAX_BYTES_CSV} bytes; no se guardó nada.`;

async function main(): Promise<number> {
  let archivo: string;
  try {
    archivo = leerArgumentosImportarPrecios(process.argv.slice(2), process.env).archivo;
  } catch (e) {
    if (!(e instanceof ErrorArgumentosCarga)) throw e;
    console.error(`❌ ${e.message}\n${USO_IMPORTAR_PRECIOS}`);
    return 2;
  }
  const leido = leerArchivoAcotado(archivo, MAX_BYTES_CSV);
  if (!leido.ok && leido.codigo === "ARCHIVO_DEMASIADO_GRANDE") {
    console.error(DEMASIADO_GRANDE);
    return 1;
  }
  if (!leido.ok) {
    console.error(`❌ ${leido.codigo} · no se pudo leer el CSV indicado (debe ser un archivo regular); no se tocó la base.`);
    return 2;
  }
  const csv = leerCsvCierres(leido.bytes);
  if (!csv.ok) {
    for (const linea of csv.codigo === "CSV_DEMASIADO_GRANDE" ? [DEMASIADO_GRANDE] : reporteErroresCsv(csv)) console.error(linea);
    return 1;
  }
  const db = new PrismaClient();
  try {
    const reporte = reporteImportacion(await importarPrecios(db, csv, { ahora: new Date() }));
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
    console.error(`❌ La importación de precios falló: ${e instanceof Error ? e.name : "error"}`);
    process.exitCode = 1;
  });
