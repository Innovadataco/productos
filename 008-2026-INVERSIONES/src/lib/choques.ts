/**
 * Choques de concurrencia con la base: la detección común de los caminos de escritura que reintentan o informan un
 * choque. Prueba propia: tests/unit/lib/choques.test.ts.
 *
 * Los choques:
 * - P2002: violación de un índice único.
 * - P2034: conflicto de escritura o bloqueo mutuo; la transacción no se pudo serializar.
 * - 23P01: violación de una exclusión (vigencias solapadas). Prisma 5.22 la entrega como
 *   PrismaClientUnknownRequestError, sin código: solo se mira el SQLSTATE del mensaje (verificado en
 *   tests/integracion/series-importar.test.ts). El mensaje nunca se muestra: trae la clave y las fechas.
 *
 * Hay dos formas de mirar el código, y cada sitio conserva la suya:
 * - `tieneCodigo` y `esUnicidad` miran el campo `code`, sin exigir la clase. Así lo hacían las series, el fondo y los
 *   precios, y sus pruebas usan errores falsos con ese campo.
 * - `esErrorPrisma` exige la clase PrismaClientKnownRequestError. Así lo hacían los decretos, los rendimientos, la
 *   certificación, la conciliación y las escisiones.
 * Lo que cada camino hace con el choque (reintentar, CONFLICTO_CONCURRENTE, un código de negocio) sigue en su módulo.
 */
import { Prisma } from "@prisma/client";

/** Violación de un índice único. */
export const CODIGO_UNICIDAD = "P2002";
/** Conflicto de escritura o bloqueo mutuo: la transacción no se pudo serializar. */
export const CODIGO_SERIALIZACION = "P2034";
/** El SQLSTATE de la exclusión, como palabra suelta en el mensaje. */
const SQLSTATE_EXCLUSION = /\b23P01\b/;

/** ¿El campo `code` del error es uno de `codigos`? No exige la clase de Prisma. */
export function tieneCodigo(e: unknown, ...codigos: readonly string[]): boolean {
  const codigo = (e as { code?: unknown } | null)?.code;
  return typeof codigo === "string" && codigos.includes(codigo);
}

/** P2002 (índice único), por el campo `code`. */
export const esUnicidad = (e: unknown): boolean => tieneCodigo(e, CODIGO_UNICIDAD);

/** La exclusión 23P01: un PrismaClientUnknownRequestError (por su nombre) con el SQLSTATE en el mensaje. */
export function esExclusion(e: unknown): boolean {
  return e instanceof Error && e.name === "PrismaClientUnknownRequestError" && SQLSTATE_EXCLUSION.test(e.message);
}

/**
 * Forma estricta: un PrismaClientKnownRequestError con ese código. Estrecha el tipo, así que después se puede leer
 * `meta`. Llámela con un `unknown`: con una unión que incluya la clase, la rama falsa la descartaría aunque el error
 * fuera de Prisma con otro código.
 */
export function esErrorPrisma(e: unknown, codigo: string): e is Prisma.PrismaClientKnownRequestError {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === codigo;
}
