/**
 * Comando del acceso inicial y de la recuperación (D-014). Lo envuelve `scripts/crear-acceso-inicial.ts`,
 * y lo corre Jelk (no la Fábrica):
 *   npx tsx scripts/crear-acceso-inicial.ts --email <correo>
 * Crea el dueño sin contraseña (o reutiliza el que hay) e imprime UNA vez el enlace de un solo uso
 * `${APP_ORIGEN}/definir-clave#t=<token>&u=<correo>`. El token va en el fragmento: el navegador no lo
 * manda al servidor, así que no queda en logs ni en `Referer` (el correo es para el gestor de claves). Vence a los 30 min. Si se pierde la contraseña,
 * el mismo comando da un enlace de recuperación (y el anterior deja de valer).
 */
import type { PrismaClient } from "@prisma/client";
import type { Writable } from "node:stream";
import { ErrorAcceso, emitirAcceso } from "./acceso";
import { EMAIL_MAX } from "./limites";
import { ErrorOrigen, origenesPermitidos, type FuenteOrigen } from "./origen";

export interface Consola {
  readonly salida: Writable;
  readonly error: Writable;
}

class ErrorUso extends Error {
  override readonly name = "ErrorUso";
}

const USO = "Uso: npx tsx scripts/crear-acceso-inicial.ts --email <correo>";
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SALIDA_USO = 2;

function leerEmail(argv: readonly string[]): string {
  if (argv.length !== 2 || argv[0] !== "--email") throw new ErrorUso("Se espera solo --email <correo>.");
  const email = (argv[1] ?? "").trim();
  if (!email || email.length > EMAIL_MAX || !CORREO.test(email)) throw new ErrorUso("El --email no parece un correo.");
  return email;
}

/** Devuelve el código de salida: 0 bien, 2 uso o regla, 1 error inesperado (solo su código). */
export async function ejecutar(argv: readonly string[], consola: Consola, db: PrismaClient, env: FuenteOrigen): Promise<number> {
  try {
    const email = leerEmail(argv);
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
    if (e instanceof ErrorAcceso || e instanceof ErrorOrigen) {
      consola.error.write(`❌ ${e.message}\n`);
      return SALIDA_USO;
    }
    // Sin el mensaje crudo: un error de Prisma puede traer la URL de conexión.
    const codigo = (e as { code?: unknown })?.code ?? (e as Error)?.name ?? "desconocido";
    consola.error.write(`❌ No se pudo emitir el enlace (código: ${String(codigo)}).\n`);
    return 1;
  }
}
