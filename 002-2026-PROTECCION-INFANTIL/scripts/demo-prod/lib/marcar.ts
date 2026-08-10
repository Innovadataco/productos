import { prisma } from "./prisma";

export interface MarcarOptions {
    corrida?: string;
    script?: string;
    notas?: string;
}

export async function marcarDemo(entidad: string, entidadId: string, options: MarcarOptions = {}) {
    const { corrida = "demo-002-PI-059", script = "sembrar-demo", notas } = options;
    await prisma.demoMarcado.upsert({
        where: { entidad_entidadId: { entidad, entidadId } },
        update: {},
        create: {
            entidad,
            entidadId,
            metadata: { corrida, script, ...(notas ? { notas } : {}) },
        },
    });
}

export async function marcarMuchos(entidad: string, ids: string[], options: MarcarOptions = {}) {
    for (const id of ids) {
        await marcarDemo(entidad, id, options);
    }
}
