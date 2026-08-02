import { PrismaClient } from "@prisma/client";

// Singleton estándar de Next.js: en dev el cliente sobrevive al hot-reload
// guardándolo en globalThis (declaración ambiental, sin casts).
declare global {
    var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalThis.prisma = prisma;
