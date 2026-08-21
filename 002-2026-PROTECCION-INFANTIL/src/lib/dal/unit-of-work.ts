/**
 * SPEC-053 (D2): cliente transaccional inyectable para la capa de datos (DAL).
 * Todo repositorio y servicio del DAL acepta un `tx?: Prisma.TransactionClient`
 * opcional; si no se provee, se usa el singleton `prisma`. `withUnitOfWork`
 * comparte UNA unidad de trabajo entre varios repositorios sin anidar
 * `prisma.$transaction` (una tx anidada abriría otra transacción real).
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma.ts";

/** Cliente de BD que aceptan los repositorios: la tx inyectada o el singleton. */
export type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Ejecuta `fn` dentro de una unidad de trabajo. Si ya hay una tx activa la
 * reutiliza (no anida); si no, abre una nueva `prisma.$transaction`.
 */
export async function withUnitOfWork<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
    tx?: Prisma.TransactionClient
): Promise<T> {
    if (tx) return fn(tx);
    return prisma.$transaction(fn);
}
