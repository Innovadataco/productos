/**
 * Registra la constitución del fondo (FIC) con las unidades y el aporte que dice el extracto del FIC (frente
 * fondo-movimientos). Es lo que ningún archivo trae: sin ella, la conciliación dice «fondo_sin_unidades» y
 * «aporte_fic_sin_registrar».
 *   npx tsx scripts/registrar-movimiento-fondo.ts --email <correo-del-dueño> --fondo <código del fondo en la SFC> \
 *     --fecha AAAA-MM-DD --unidades <n> --monto <n> [--aplicar]
 * En producción va por la vía B: `cargar-prod.sh registrar-movimiento-fondo`, con los argumentos en la cabecera del
 * sobre (docs/despliegue/produccion.md §11); inv-cargar los pasa por su lista blanca.
 * Antes: el fondo registrado y el valor de unidad de la SFC de ese día cargado. Sin --aplicar es ensayo (no escribe).
 * Después: conciliar-certificacion. Nunca imprime las cifras, el correo ni el código del fondo: solo ids y códigos
 * (src/fondo/salida-movimiento.ts).
 * Salida: 0 ensayo, registrada o ya existía · 1 error de la base o inesperado (no se sabe si quedó registrada) · 2 uso o
 *   datos inválidos · 3 rechazado (no escribió).
 */
import { PrismaClient } from "@prisma/client";
import { interpretarArgumentosMovimiento } from "../src/fondo/argumentos-movimiento";
import { ErrorMovimientoFondo, registrarConstitucion } from "../src/fondo/movimiento";
import {
  emitir, salidaDatosInvalidos, salidaErrorBase, salidaInesperada, salidaRechazo, salidaResultado, type SalidaCli,
} from "../src/fondo/salida-movimiento";

// La imagen del migrador trae NODE_ENV=production: allí los pasos son los de la vía B (cargar-prod.sh).
const opciones = { produccion: process.env.NODE_ENV === "production" };

async function main(): Promise<SalidaCli> {
  const a = interpretarArgumentosMovimiento(process.argv.slice(2), new Date());
  if (!a.ok) return salidaDatosInvalidos(a.errores, opciones);
  const db = new PrismaClient();
  try {
    return salidaResultado(await registrarConstitucion(db, a.datos, { aplicar: a.aplicar }), opciones);
  } catch (e) {
    return e instanceof ErrorMovimientoFondo ? salidaRechazo(e.codigo, opciones) : salidaErrorBase(e, opciones);
  } finally {
    await db.$disconnect();
  }
}

// exitCode y no exit(): en macOS stdout por tubería es asíncrono y exit() podría cortar la salida. El catch va
// después del then: también atrapa un fallo al cerrar la base o al escribir la salida (no se sabe qué llegó a verse).
main()
  .then((s) => {
    process.exitCode = emitir(s, console);
  })
  .catch((e: unknown) => {
    process.exitCode = emitir(salidaInesperada(e, opciones), console);
  });
