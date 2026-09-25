import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface MarcarOptions {
    corrida?: string;
    script?: string;
    notas?: string;
}

/**
 * Marca una entidad como demo. `db` acepta un cliente de transacción para que la marca
 * viva DENTRO de la misma transacción que crea la fila (atomicidad: si la siembra falla y
 * hace rollback, la marca NO queda huérfana). Por defecto usa el singleton (compatibilidad).
 */
export async function marcarDemo(
    entidad: string,
    entidadId: string,
    options: MarcarOptions = {},
    db: Prisma.TransactionClient = prisma,
) {
    const { corrida = "demo-002-PI-059", script = "sembrar-demo", notas } = options;
    await db.demoMarcado.upsert({
        where: { entidad_entidadId: { entidad, entidadId } },
        update: {},
        create: {
            entidad,
            entidadId,
            metadata: { corrida, script, ...(notas ? { notas } : {}) },
        },
    });
}

export async function marcarMuchos(
    entidad: string,
    ids: string[],
    options: MarcarOptions = {},
    db: Prisma.TransactionClient = prisma,
) {
    for (const id of ids) {
        await marcarDemo(entidad, id, options, db);
    }
}
