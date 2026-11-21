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

/** Crea un dueño ficticio con correo único; con clave (ficticia) o sin ella (para el enlace de un solo uso). */
export async function crearCuenta(info: TestInfo, prefijo: string, conClave: boolean): Promise<CuentaE2E> {
  const cuenta = { email: `${prefijo}-${sufijo(info)}@ejemplo.invalid`, clave: `clave-ficticia-${prefijo}-e2e` };
  await baseE2E().usuario.create({
    data: { email: cuenta.email, rol: "DUENO", claveHash: conClave ? await hashClave(cuenta.clave) : null },
  });
  return cuenta;
}
