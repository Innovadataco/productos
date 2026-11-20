import { PrismaClient } from "@prisma/client";

// Un solo cliente por proceso (en desarrollo, Next recarga módulos y abriría conexiones de más).
const globalParaPrisma = globalThis as unknown as { prismaInv008?: PrismaClient };

export const db: PrismaClient = globalParaPrisma.prismaInv008 ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalParaPrisma.prismaInv008 = db;
}
