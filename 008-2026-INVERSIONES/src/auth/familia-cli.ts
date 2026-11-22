/**
 * Comando del acceso de un familiar (frente familia-lectura). Lo envuelve `scripts/acceso-familiar.ts` y lo corre Jelk,
 * nunca la Fábrica (maneja accesos); en el VPS, por `scripts/acceso-familiar.sh` (migrador, rol inv_dueno):
 *   npx tsx scripts/acceso-familiar.ts --email <correo>                   alta o recuperación de la clave
 *   npx tsx scripts/acceso-familiar.ts --email <correo> --revocar         lo desactiva y cierra sus sesiones
 *   npx tsx scripts/acceso-familiar.ts --email <correo> --reiniciar-totp  borra su segundo factor
 * El alta imprime UNA vez el enlace de un solo uso `${APP_ORIGEN}/definir-clave#t=<token>&u=<correo>` (el token en el
 * fragmento: no llega al servidor ni a los registros). Lista blanca: `--email <correo>` y, si acaso, UNA de las dos
 * acciones; nada más. En producción, todo exige la conexión de inv_dueno. Ningún mensaje recomienda comprar ni vender,
 * y un error inesperado sale solo con su código (el de Prisma puede traer la URL de conexión).
 */
import type { PrismaClient } from "@prisma/client";
import type { Writable } from "node:stream";
import { correoDeCli } from "../cli/correo";
import { ROL_DUENO, conexionDelDueno } from "./conexion-dueno";
import { ErrorFamiliar, emitirAccesoFamiliar, reiniciarTotpFamiliar, revocarFamiliar, type EmisionFamiliar } from "./familia";
import { ErrorOrigen, origenesPermitidos, type FuenteOrigen } from "./origen";

export interface Consola {
  readonly salida: Writable;
  readonly error: Writable;
}

class ErrorUso extends Error {
  override readonly name = "ErrorUso";
}

class ErrorRol extends Error {
  override readonly name = "ErrorRol";
}

const USO = "Uso: npx tsx scripts/acceso-familiar.ts --email <correo> [--revocar | --reiniciar-totp]";
const SALIDA_USO = 2;
const ACCIONES = ["--revocar", "--reiniciar-totp"] as const;
type Accion = "alta" | (typeof ACCIONES)[number];

interface Orden {
  readonly email: string;
  readonly accion: Accion;
}

const esAccion = (a: string): a is (typeof ACCIONES)[number] => (ACCIONES as readonly string[]).includes(a);

/** `--email <correo>` y, si acaso, UNA acción (antes o después). El correo pasa por correoDeCli: una opción nunca lo es. */
function leerOrden(argv: readonly string[]): Orden {
  const acciones = argv.filter(esAccion);
  const resto = argv.filter((a) => !esAccion(a));
  if (acciones.length > 1 || resto.length !== 2 || resto[0] !== "--email") {
    throw new ErrorUso("Se espera --email <correo> y, si acaso, una sola de --revocar o --reiniciar-totp.");
  }
  const email = correoDeCli(resto[1]);
  if (email === null) throw new ErrorUso("El --email no parece un correo (ni puede empezar por «-»).");
  return { email, accion: acciones[0] ?? "alta" };
}

function textoDelAlta(email: string, origen: string | undefined, r: EmisionFamiliar): string {
  const que = r.proposito === "RECUPERACION" ? "Enlace de recuperación de la clave" : r.creado ? "Familiar creado" : "Acceso inicial";
  return (
    `✅ ${que} para el familiar ${email} (solo lectura: ve el portafolio, no cambia nada).\n` +
    "Entrégueselo en persona o por un canal cifrado; sirve un solo uso y vence en 30 minutos. Después de definir su\n" +
    "clave tiene 30 minutos para activar su segundo factor (TOTP) al entrar:\n" +
    `${origen}/definir-clave#t=${r.token}&u=${encodeURIComponent(email)}\n`
  );
}

async function correrOrden(orden: Orden, consola: Consola, db: PrismaClient, env: FuenteOrigen): Promise<number> {
  if (!(await conexionDelDueno(db, env))) {
    throw new ErrorRol(`En producción este comando corre con el rol ${ROL_DUENO} (scripts/acceso-familiar.sh); esta conexión usa otro. No se cambia nada.`);
  }
  const ahora = new Date();
  if (orden.accion === "--revocar") {
    const r = await revocarFamiliar(db, { email: orden.email, ahora });
    consola.salida.write(
      r.yaEstaba
        ? `ℹ️ El familiar ${orden.email} ya estaba revocado: no se cambió nada.\n`
        : `✅ Acceso revocado para el familiar ${orden.email}: la cuenta queda inactiva y se cerraron sus sesiones.\n`,
    );
    return 0;
  }
  if (orden.accion === "--reiniciar-totp") {
    await reiniciarTotpFamiliar(db, { email: orden.email, ahora });
    consola.salida.write(
      `✅ Segundo factor reiniciado para el familiar ${orden.email}: se borró su enrolamiento, se anularon sus códigos y se cerraron sus sesiones.\n` +
        "Debe entrar con su clave en los próximos 30 minutos y escanear el QR nuevo. Pasado ese plazo, vuelva a correr este comando.\n",
    );
    return 0;
  }
  const origen = origenesPermitidos(env)[0];
  consola.salida.write(textoDelAlta(orden.email, origen, await emitirAccesoFamiliar(db, { email: orden.email, ahora })));
  return 0;
}

/** Devuelve el código de salida: 0 bien, 2 uso o regla, 1 error inesperado (solo su código). */
export async function ejecutar(argv: readonly string[], consola: Consola, db: PrismaClient, env: FuenteOrigen): Promise<number> {
  try {
    return await correrOrden(leerOrden(argv), consola, db, env);
  } catch (e) {
    if (e instanceof ErrorUso) {
      consola.error.write(`❌ ${e.message}\n${USO}\n`);
      return SALIDA_USO;
    }
    if (e instanceof ErrorFamiliar || e instanceof ErrorOrigen || e instanceof ErrorRol) {
      consola.error.write(`❌ ${e.message}\n`);
      return SALIDA_USO;
    }
    // Sin el mensaje crudo: un error de Prisma puede traer la URL de conexión.
    const codigo = (e as { code?: unknown })?.code ?? (e as Error)?.name ?? "desconocido";
    consola.error.write(`❌ No se pudo completar (código: ${String(codigo)}).\n`);
    return 1;
  }
}
