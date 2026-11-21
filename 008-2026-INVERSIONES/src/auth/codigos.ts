/**
 * Códigos de recuperación en la base: 10 nuevos por generación; al generar se anulan los vigentes
 * (`anuladoEn`), así regenerarlos deja sin valor los anteriores. En la base va solo el sha256 de cada uno;
 * los códigos en claro se devuelven UNA vez para mostrarlos (src/auth/recuperacion.ts).
 * Las marcas (`usadoEn`, `anuladoEn`) nunca quedan antes de `creadoEn` (CHECK de la base): se ponen con
 * GREATEST(ahora, creadoEn), porque el reloj de un pedido concurrente puede ir unos milisegundos atrás.
 */
import { Prisma } from "@prisma/client";
import { generarCodigosRecuperacion, hashCodigoRecuperacion, normalizarCodigoRecuperacion } from "./recuperacion";

type Tx = Prisma.TransactionClient;

/** Anula los códigos vigentes de la cuenta. */
const marca = (ahora: Date): Prisma.Sql => Prisma.sql`GREATEST(${ahora.toISOString()}::timestamptz, "creadoEn")`;

export async function anularCodigos(tx: Tx, usuarioId: string, ahora: Date): Promise<void> {
  await tx.$executeRaw`
    UPDATE "codigo_recuperacion" SET "anuladoEn" = ${marca(ahora)}
    WHERE "usuarioId" = ${usuarioId} AND "usadoEn" IS NULL AND "anuladoEn" IS NULL`;
}

/** Anula los vigentes y crea 10 nuevos. Devuelve los códigos en claro (para mostrarlos una sola vez). */
export async function crearCodigosRecuperacion(tx: Tx, usuarioId: string, ahora: Date): Promise<readonly string[]> {
  await anularCodigos(tx, usuarioId, ahora);
  const codigos = generarCodigosRecuperacion();
  await tx.codigoRecuperacion.createMany({
    data: codigos.map((c) => ({ usuarioId, codigoHash: hashCodigoRecuperacion(normalizarCodigoRecuperacion(c) ?? ""), creadoEn: ahora })),
  });
  return codigos;
}

/**
 * Gasta un código vigente de la cuenta. Un solo UPDATE condicionado: si dos pedidos llegan a la vez con el
 * mismo código, el segundo ya no lo ve vigente. Devuelve cuántos quedan, o null si no había uno vigente.
 */
export async function gastarCodigo(tx: Tx, usuarioId: string, normalizado: string, ahora: Date): Promise<number | null> {
  const gastados = await tx.$executeRaw`
    UPDATE "codigo_recuperacion" SET "usadoEn" = ${marca(ahora)}
    WHERE "usuarioId" = ${usuarioId} AND "codigoHash" = ${hashCodigoRecuperacion(normalizado)}
      AND "usadoEn" IS NULL AND "anuladoEn" IS NULL`;
  if (gastados !== 1) return null;
  return tx.codigoRecuperacion.count({ where: { usuarioId, usadoEn: null, anuladoEn: null } });
}
