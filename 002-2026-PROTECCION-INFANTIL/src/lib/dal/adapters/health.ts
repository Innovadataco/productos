/**
 * E-8 (002-PI-056, D3): adaptador de infraestructura para chequeos de salud.
 * La raw query de conectividad vive AQUÍ, nunca en la ruta.
 */
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

/** true si la BD responde (`SELECT 1`); false si la conexión falla. */
export async function verificarConexionDb(db: DbClient = prisma): Promise<boolean> {
    try {
        await db.$queryRaw`SELECT 1`;
        return true;
    } catch {
        return false;
    }
}
