/**
 * Registra la constitución del fondo (FIC) con las unidades y el aporte que dice el extracto del FIC (frente
 * fondo-movimientos). Es lo que ningún archivo trae: sin ella, la conciliación dice «fondo_sin_unidades» y
 * «aporte_fic_sin_registrar».
 *   npx tsx scripts/registrar-movimiento-fondo.ts --email <correo-del-dueño> --fondo <código del fondo en la SFC> \
 *     --fecha AAAA-MM-DD --unidades <n> --monto <n> [--aplicar]
 * Antes: el fondo registrado y el valor de unidad de la SFC de ese día cargado. Sin --aplicar es ensayo (no escribe).
 * Después: conciliar-certificacion. Nunca imprime las cifras, el correo ni el código del fondo: solo ids y códigos.
 * Salida: 0 ensayo, registrada o ya existía · 1 error de la base · 2 uso o datos inválidos · 3 rechazado (no escribió).
 */
import { PrismaClient } from "@prisma/client";
import { interpretarArgumentosMovimiento, USO_MOVIMIENTO } from "../src/fondo/argumentos-movimiento";
import { ErrorMovimientoFondo, registrarConstitucion } from "../src/fondo/movimiento";
import { textoRechazo, textoResultado } from "../src/fondo/salida-movimiento";
import { detalleDeError } from "../src/precios/guardar";

async function main(): Promise<void> {
  const a = interpretarArgumentosMovimiento(process.argv.slice(2), new Date());
  if (!a.ok) {
    console.error("❌ Datos inválidos, no se registró nada:");
    for (const e of a.errores) console.error(`   ${e.campo} · ${e.codigo}`);
    console.error(USO_MOVIMIENTO);
    process.exitCode = 2;
    return;
  }
  const db = new PrismaClient();
  try {
    console.log(textoResultado(await registrarConstitucion(db, a.datos, { aplicar: a.aplicar })));
  } catch (e) {
    if (e instanceof ErrorMovimientoFondo) {
      console.error(textoRechazo(e.codigo));
      process.exitCode = 3;
    } else {
      // Solo el nombre y el código del error (p. ej. «PrismaClientKnownRequestError P2028»), nunca su mensaje.
      console.error(`❌ No se registró: ERROR_BASE (${detalleDeError(e)})`);
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

void main();
