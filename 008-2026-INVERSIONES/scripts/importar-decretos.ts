/**
 * Registra los decretos de dividendos del CSV del dueño (fase C, C4a).
 *   npx tsx scripts/importar-decretos.ts --archivo <decretos.csv> --email <correo-del-dueño> [--aplicar]
 * - Contrato del CSV en src/datos-oficiales/decretos/csv.ts: una fila por cuota, con su referencia oficial. Todo o nada.
 * - Sin --aplicar es ensayo: valida, resuelve las especies y cuenta, sin escribir. Con --aplicar escribe por el camino
 *   único (src/datos-oficiales/decretos/guardar.ts): un cambio es la versión siguiente, que retira a la anterior, y
 *   anular es una versión nueva `anulada` con su nota. Reimportar el mismo CSV no escribe nada.
 * - El motor de proyecciones cruza los decretos con los pagos de Trii por ventana (C5b): un pago que Trii acredita otro
 *   día no se cuenta dos veces. --aplicar escribe en la base de DATABASE_URL.
 * - Lee un archivo REGULAR con tope (src/lib/archivo-acotado.ts). Usa DATABASE_URL y las claves de cifrado del entorno
 *   (el crudo de cada fila se guarda cifrado). Imprime solo el modo, conteos, códigos, números de línea y el id de la
 *   carga: nunca especies, valores, fechas, referencias, notas ni el correo. El archivo original no se guarda, ni su
 *   nombre (puede nombrar una especie): la carga dice «decretos.csv» y la identifica su sha256.
 * Salida: 0 bien · 1 error de la base o del cifrado · 2 uso o archivo ilegible · 3 rechazado (no escribió nada).
 */
import { PrismaClient } from "@prisma/client";
import { leerArgumentosDecretos, salidaUso } from "../src/datos-oficiales/decretos/argumentos";
import { MAX_BYTES_DECRETOS } from "../src/datos-oficiales/decretos/csv";
import { importarDecretos, salidaArchivo, salidaDecretos } from "../src/datos-oficiales/decretos/importar";
import { emitir, salidaError, type SalidaCli } from "../src/datos-oficiales/registro/reporte";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";

// La imagen del migrador trae NODE_ENV=production: allí el CLI corre por la vía B (§11 del runbook).
const opciones = { produccion: process.env.NODE_ENV === "production" };

async function main(): Promise<SalidaCli> {
  const a = leerArgumentosDecretos(process.argv.slice(2));
  if (!a.ok) return salidaUso(a.codigo, opciones);
  const leido = leerArchivoAcotado(a.archivo, MAX_BYTES_DECRETOS);
  if (!leido.ok) return salidaArchivo(leido.codigo, opciones);
  const db = new PrismaClient();
  try {
    const r = await importarDecretos(db, { contenido: leido.bytes, email: a.email, aplicar: a.aplicar });
    return salidaDecretos(r, opciones);
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
    process.exitCode = emitir(salidaError(e, opciones), console);
  });
