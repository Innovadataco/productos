/**
 * Cuentas del E2E creadas por cada prueba (D-014): correo único por prueba y repetición, así una prueba
 * que bloquea o cambia una cuenta no afecta a otra ni a su repetición (`--repeat-each`). Todo inventado.
 * Se conecta solo a la base e2e local (candado de tests/e2e/base.ts).
 */
import { PrismaClient } from "@prisma/client";
import type { TestInfo } from "@playwright/test";
import { hashClave } from "../../src/auth/clave";
import { URL_E2E_POR_DEFECTO, baseDePruebas, type CuentaE2E } from "./base";

let db: PrismaClient | null = null;

export function baseE2E(): PrismaClient {
  db ??= new PrismaClient({ datasourceUrl: baseDePruebas(process.env.DATABASE_URL_E2E ?? URL_E2E_POR_DEFECTO).url });
  return db;
}

export async function cerrarBaseE2E(): Promise<void> {
  await db?.$disconnect();
  db = null;
}

/** Sufijo único de la prueba en curso: su id, la repetición, el reintento y la hora. */
export const sufijo = (info: TestInfo): string =>
  `${info.testId}-r${info.repeatEachIndex}-${info.retry}-${Date.now().toString(36)}`.toLowerCase().replace(/[^a-z0-9-]/g, "");

export interface OpcionesCuenta {
  /**
   * Hace cuántos minutos «se definió la clave con el enlace» (un CLAVE_DEFINIDA en el registro): abre la
   * ventana de 30 min para enrolar el TOTP. Por defecto, ahora mismo; null, nunca (clave puesta a mano).
   */
  readonly claveDefinidaHaceMin?: number | null;
}

const MIN_MS = 60_000;

/**
 * Crea un dueño ficticio con correo único; con clave (ficticia) o sin ella (para el enlace de un solo uso).
 * Con clave, simula que la definió con el enlace: así puede enrolar el TOTP en su primer ingreso.
 */
export async function crearCuenta(info: TestInfo, prefijo: string, conClave: boolean, opciones: OpcionesCuenta = {}): Promise<CuentaE2E> {
  const cuenta = { email: `${prefijo}-${sufijo(info)}@ejemplo.invalid`, clave: `clave-ficticia-${prefijo}-e2e` };
  const u = await baseE2E().usuario.create({
    data: { email: cuenta.email, rol: "DUENO", claveHash: conClave ? await hashClave(cuenta.clave) : null },
  });
  const hace = opciones.claveDefinidaHaceMin === undefined ? 0 : opciones.claveDefinidaHaceMin;
  if (conClave && hace !== null) {
    await baseE2E().intentoIngreso.create({ data: { usuarioId: u.id, resultado: "CLAVE_DEFINIDA", ocurridoEn: new Date(Date.now() - hace * MIN_MS) } });
  }
  return cuenta;
}
