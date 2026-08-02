/**
 * E-8: tests del DatasetEntrenamientoRepository — la regla dura del listado
 * (solo anonimizados) con conteos totales visibles.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { DatasetEntrenamientoRepository } from "./dataset-entrenamiento";
import { prisma } from "@/lib/prisma";

async function sembrar(anonimizado: boolean, texto: string) {
    return new DatasetEntrenamientoRepository().crear({
        texto,
        clasificacionCorrecta: "OTRO",
        fuente: "correccion_admin",
        textoAnonimizado: anonimizado,
    });
}

describe("DatasetEntrenamientoRepository", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("el listado solo expone anonimizados; los conteos cubren todos y solo anonimizados", async () => {
        const repo = new DatasetEntrenamientoRepository();
        const a1 = await sembrar(true, "texto anonimizado uno");
        await sembrar(true, "texto anonimizado dos");
        await sembrar(false, "texto SIN anonimizar");

        const pagina = await repo.listarAnonimizadosPaginados({ skip: 0, take: 25 });
        expect(pagina.map((r) => r.id)).toHaveLength(2);
        expect(pagina.some((r) => r.id === a1.id)).toBe(true);
        expect(pagina.every((r) => r.textoAnonimizado)).toBe(true);

        expect(await repo.contarTodos()).toBe(3);
        expect(await repo.contarAnonimizados()).toBe(2);
    });

    it("paginación: skip/take se respetan", async () => {
        const repo = new DatasetEntrenamientoRepository();
        for (let i = 0; i < 3; i++) {
            await sembrar(true, `texto ${i}`);
        }
        const pagina = await repo.listarAnonimizadosPaginados({ skip: 2, take: 1 });
        expect(pagina).toHaveLength(1);
    });
});
