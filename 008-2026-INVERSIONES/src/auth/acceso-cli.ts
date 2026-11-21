/**
 * Comando del acceso inicial y de la recuperación (D-014). Lo envuelve `scripts/crear-acceso-inicial.ts`,
 * y lo corre Jelk (no la Fábrica):
 *   npx tsx scripts/crear-acceso-inicial.ts --email <correo>
 * Crea el dueño sin contraseña (o reutiliza el que hay) e imprime UNA vez el enlace de un solo uso
 * `${APP_ORIGEN}/definir-clave#t=<token>&u=<correo>`. El token va en el fragmento: el navegador no lo
 * manda al servidor, así que no queda en logs ni en `Referer` (el correo es para el gestor de claves). Vence a los 30 min. Si se pierde la contraseña,
 * el mismo comando da un enlace de recuperación (y el anterior deja de valer).
 * Con `--reiniciar-totp` (recuperación total del segundo factor: perdió el teléfono Y los códigos) no emite
 * enlace: borra el enrolamiento del TOTP y cierra las sesiones (src/auth/reinicio-totp.ts). Después, Jelk
 * entra con su clave antes de 30 minutos y enrola de nuevo.
 */
import type { PrismaClient } from "@prisma/client";
import type { Writable } from "node:stream";
import { correoDeCli } from "../cli/correo";
import { ErrorAcceso, emitirAcceso } from "./acceso";
import { ErrorOrigen, origenesPermitidos, type FuenteOrigen } from "./origen";
import { reiniciarTotp } from "./reinicio-totp";

export interface Consola {
  readonly salida: Writable;
  readonly error: Writable;
}

class ErrorUso extends Error {
  override readonly name = "ErrorUso";
}

/** La conexión no es la del rol que corresponde (no es un error de uso: no muestra el uso). */
class ErrorRol extends Error {
  override readonly name = "ErrorRol";
}

const USO = "Uso: npx tsx scripts/crear-acceso-inicial.ts --email <correo> [--reiniciar-totp]";
const BANDERA_TOTP = "--reiniciar-totp";
const SALIDA_USO = 2;

interface Orden {
  readonly email: string;
  readonly reiniciarTotp: boolean;
}

/**
 * `--email <correo>`, y opcionalmente `--reiniciar-totp` (antes o después), nada más. El correo pasa por
 * correoDeCli (O1): un valor que empieza por «-» nunca es el correo, aunque tenga su forma.
 */
function leerOrden(argv: readonly string[]): Orden {
  const reiniciar = argv.filter((a) => a === BANDERA_TOTP).length;
  const resto = argv.filter((a) => a !== BANDERA_TOTP);
  if (reiniciar > 1 || resto.length !== 2 || resto[0] !== "--email") throw new ErrorUso(`Se espera --email <correo> y, si acaso, ${BANDERA_TOTP}.`);
  const email = correoDeCli(resto[1]);
  if (email === null) throw new ErrorUso("El --email no parece un correo (ni puede empezar por «-»).");
  return { email, reiniciarTotp: reiniciar === 1 };
}

/** El rol del migrador en producción: el dueño de las tablas (inv_app no puede ni debe reiniciar). */
const ROL_DUENO = "inv_dueno";

/** En producción, `--reiniciar-totp` solo corre conectado como inv_dueno (crear-acceso-inicial.sh). */
async function exigirRolDueno(db: PrismaClient, env: FuenteOrigen): Promise<void> {
  if (env.NODE_ENV !== "production") return;
  const filas = await db.$queryRaw<{ rol: string }[]>`SELECT current_user::text AS "rol"`;
  if (filas[0]?.rol !== ROL_DUENO) {
    throw new ErrorRol(`En producción --reiniciar-totp corre con el rol ${ROL_DUENO} (scripts/crear-acceso-inicial.sh); esta conexión usa otro. No se reinicia nada.`);
  }
}

async function reiniciar(email: string, consola: Consola, db: PrismaClient, env: FuenteOrigen): Promise<number> {
  await exigirRolDueno(db, env);
  await reiniciarTotp(db, { email, ahora: new Date() });
  consola.salida.write(
    `✅ Segundo factor reiniciado para ${email}: se borró el enrolamiento, se anularon los códigos de recuperación y se cerraron todas las sesiones.\n` +
      "Entre con su clave en los próximos 30 minutos y escanee el QR nuevo. Pasado ese plazo, vuelva a correr este comando.\n",
  );
  return 0;
}

/** Devuelve el código de salida: 0 bien, 2 uso o regla, 1 error inesperado (solo su código). */
export async function ejecutar(argv: readonly string[], consola: Consola, db: PrismaClient, env: FuenteOrigen): Promise<number> {
  try {
    const { email, reiniciarTotp: soloTotp } = leerOrden(argv);
    if (soloTotp) return await reiniciar(email, consola, db, env);
    const origen = origenesPermitidos(env)[0];
    const r = await emitirAcceso(db, { email, ahora: new Date() });
    const que = r.proposito === "INICIAL" ? (r.creado ? "Cuenta creada" : "Acceso inicial") : "Enlace de recuperación";
    consola.salida.write(
      `✅ ${que} para ${email}. Abra este enlace; sirve un solo uso y vence en 30 minutos (no lo comparta):\n` +
        `${origen}/definir-clave#t=${r.token}&u=${encodeURIComponent(email)}\n`,
    );
    return 0;
  } catch (e) {
    if (e instanceof ErrorUso) {
      consola.error.write(`❌ ${e.message}\n${USO}\n`);
      return SALIDA_USO;
    }
    if (e instanceof ErrorAcceso || e instanceof ErrorOrigen || e instanceof ErrorRol) {
      consola.error.write(`❌ ${e.message}\n`);
      return SALIDA_USO;
    }
    // Sin el mensaje crudo: un error de Prisma puede traer la URL de conexión.
    const codigo = (e as { code?: unknown })?.code ?? (e as Error)?.name ?? "desconocido";
    consola.error.write(`❌ No se pudo completar (código: ${String(codigo)}).\n`);
    return 1;
  }
}
