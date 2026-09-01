import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma del 006 — singleton sobre globalThis: en dev el hot-reload
 * de Next re-importa los módulos y sin esto cada recarga abriría un pool
 * nuevo hasta agotar las conexiones de PostgreSQL.
 *
 * B3: la conexión vive SOLO en la variable de entorno DATABASE_URL,
 * nada quemado en código. Sin logs en producción (D1: los recolecta el
 * contenedor); en dev solo warn/error para no ahogar la consola.
 */
const globalParaPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
    globalParaPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "production" ? [] : ["warn", "error"],
    });

if (process.env.NODE_ENV !== "production") {
    globalParaPrisma.prisma = prisma;
}
