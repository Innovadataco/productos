import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { buscarEjemplosSimilares } from "./dataset-retrieval";

function vector(dimension: number, value: number) {
    return new Array(dimension).fill(value);
}

async function insertarDatasetEmbedding(datasetId: string, modeloUsado = "nomic-embed-text", values: number[]) {
    const vectorStr = "[" + values.join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${datasetId}, ${vectorStr}::vector, ${modeloUsado}, NOW())
    `;
}

describe("buscarEjemplosSimilares - anti-leakage del eval", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("un caso activo de CasoEval no es recuperable por el RAG", async () => {
        const textoEval = "Texto único del fixture de evaluación que no debe filtrar al retrieval";

        await prisma.casoEval.create({
            data: {
                texto: textoEval,
                categoriaEsperada: "OTRO",
                ruido: false,
                fuente: "SEMILLA",
                activo: true,
                fixtureVersion: 1,
            },
        });

        // Peor caso: el mismo texto existe en el dataset de entrenamiento (simulación de leakage).
        const dataset = await prisma.datasetEntrenamiento.create({
            data: {
                texto: textoEval,
                clasificacionCorrecta: "OTRO",
                fuente: "BACKFILL",
            },
        });

        const v = vector(768, 0.1);
        await insertarDatasetEmbedding(dataset.id, "nomic-embed-text", v);

        const similares = await buscarEjemplosSimilares(v, {
            topK: 5,
            umbral: 0,
            excluirSimilitudMayorA: 0.98,
        });

        // El filtro de excluirSimilitudMayorA=0.98 elimina coincidencias casi exactas (similitud=1.0),
        // evitando que un caso del eval se recupere desde el RAG.
        expect(similares.length).toBe(0);
    });

    it("la consulta de retrieval solo accede a DatasetEntrenamiento, no a CasoEval", async () => {
        const textoEval = "Texto exclusivo de CasoEval";

        await prisma.casoEval.create({
            data: {
                texto: textoEval,
                categoriaEsperada: "OTRO",
                ruido: false,
                fuente: "SEMILLA",
                activo: true,
                fixtureVersion: 1,
            },
        });

        const dataset = await prisma.datasetEntrenamiento.create({
            data: {
                texto: "Texto exclusivo del dataset de entrenamiento",
                clasificacionCorrecta: "OTRO",
                fuente: "BACKFILL",
            },
        });

        const v = vector(768, 0.2);
        await insertarDatasetEmbedding(dataset.id, "nomic-embed-text", v);

        const similares = await buscarEjemplosSimilares(v, { topK: 5, umbral: 0, excluirSimilitudMayorA: 1 });
        const textosRecuperados = similares.map((s) => s.texto);

        expect(textosRecuperados).not.toContain(textoEval);
    });
});
