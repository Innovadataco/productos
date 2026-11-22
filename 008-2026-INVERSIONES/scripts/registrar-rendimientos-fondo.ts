/**
 * Registra los rendimientos del fondo (FIC) pagados en efectivo y su retención en la fuente, del CSV del dueño (frente
 * fondo-rendimientos). Es lo que ningún archivo del comisionista trae: sin ellos, la conciliación del efectivo dice
 * «rendimientos_fic_sin_registrar» o «partida_sin_fuente».
 *   npx tsx scripts/registrar-rendimientos-fondo.ts --archivo <rendimientos.csv> --email <correo-del-dueño> \
 *     --fondo <código del fondo en la SFC> [--aplicar]
 * - Contrato del CSV en src/fondo/rendimientos/csv.ts: fecha,tipo,valor (RENDIMIENTO o RETENCION). Todo o nada.
 * - El RENDIMIENTO entra a la caja (ajuste RENDIMIENTO_FIC); la RETENCION queda como hecho del fondo y no mueve la caja
 *   (el pago ya llega neto). Sin --aplicar es ensayo: valida contra la base y cuenta, sin escribir. Con --aplicar escribe
 *   por el camino único (src/fondo/rendimientos/guardar.ts). Repetir el mismo CSV no escribe nada; lo registrado no se
 *   corrige (una fila ya registrada con otro valor rechaza el archivo).
 * - Antes: el fondo registrado y su constitución (registrar-movimiento-fondo). Después: conciliar-certificacion.
 * - En producción va por la vía B: `cargar-prod.sh registrar-rendimientos-fondo`, con el CSV en el sobre y --email,
 *   --fondo y --aplicar en la cabecera (docs/despliegue/produccion.md §11); inv-cargar los pasa por su lista blanca.
 * - Lee un archivo REGULAR con tope (src/lib/archivo-acotado.ts). Usa DATABASE_URL y las claves de cifrado del entorno
 *   (el crudo de cada fila se guarda cifrado). Imprime solo el modo, conteos, códigos, números de línea e ids internos:
 *   nunca valores, fechas, el código del fondo ni el correo (src/fondo/rendimientos/salida.ts). El nombre del archivo no
 *   se guarda: la carga dice «rendimientos-fondo.csv» y la identifica su sha256.
 * Salida: 0 bien · 1 error de la base o del cifrado · 2 uso o archivo ilegible · 3 rechazado (no escribió nada).
 */
import { PrismaClient } from "@prisma/client";
import { emitir, salidaError, type SalidaCli } from "../src/datos-oficiales/registro/reporte";
import { leerArgumentosRendimientos, salidaUsoRendimientos } from "../src/fondo/rendimientos/argumentos";
import { MAX_BYTES_RENDIMIENTOS } from "../src/fondo/rendimientos/csv";
import { registrarRendimientos } from "../src/fondo/rendimientos/registrar";
import { salidaArchivoRendimientos, salidaRendimientos } from "../src/fondo/rendimientos/salida";
import { leerArchivoAcotado } from "../src/lib/archivo-acotado";

// La imagen del migrador trae NODE_ENV=production: allí el CLI corre por la vía B (§11 del runbook).
const opciones = { produccion: process.env.NODE_ENV === "production" };

async function main(): Promise<SalidaCli> {
  const a = leerArgumentosRendimientos(process.argv.slice(2));
  if (!a.ok) return salidaUsoRendimientos(a.codigo, opciones);
  const leido = leerArchivoAcotado(a.archivo, MAX_BYTES_RENDIMIENTOS);
  if (!leido.ok) return salidaArchivoRendimientos(leido.codigo, opciones);
  const db = new PrismaClient();
  try {
    const r = await registrarRendimientos(db, { contenido: leido.bytes, email: a.email, codigoFic: a.codigoFic, aplicar: a.aplicar });
    return salidaRendimientos(r, opciones);
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
