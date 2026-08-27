/**
 * E-8 (LOTE 2): tests de upsertReporteEmbedding — inserta si no existe,
 * actualiza vector y modelo si existe (regeneración tras anonimizar/validar).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { prisma } from "@/lib/prisma";
import { EmbeddingRepository } from "./embedding";

const TAG = Math.random().toString(36).slice(2, 8);

async function crearReporteDePrueba(sufijo = "") {
    const plataforma = await crearPlataforma();
    const usuario = await crearUsuario("PARENT");
    return prisma.reporte.create({
        data: {
            identificador: `+57300${TAG}`,
            plataformaId: plataforma.id,
            texto: "Texto de prueba del repositorio de embeddings con suficientes caracteres.",
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            usuarioId: usuario.id,
            numeroSeguimiento: `RPT-${TAG}${sufijo}`,
            estado: "CLASIFICADO",
        },
    });
}

function vectorRelleno(valor: number): number[] {
    return new Array(768).fill(valor);
}

async function leerEmbedding(reporteId: string) {
    const rows = await prisma.$queryRaw<{ modeloUsado: string; vector: string }[]>`
        SELECT "modeloUsado", vector::text AS vector FROM "EmbeddingReporte" WHERE "reporteId" = ${reporteId}
    `;
    return rows;
}

// SPEC-283 (002-PI-180): reset POR PRUEBA porque varios tests dentro del mismo
// describe crean Reporte con el mismo numeroSeguimiento (`RPT-${TAG}` sin sufijo)
// y TAG es constante en el módulo → colisión unique al migrar a beforeAll.
describe("EmbeddingRepository (E-8 LOTE 2)", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("inserta cuando no existe embedding previo", async () => {
        const reporte = await crearReporteDePrueba();
        await new EmbeddingRepository().upsertReporteEmbedding(reporte.id, "nomic-embed-text", vectorRelleno(0.1));

        const rows = await leerEmbedding(reporte.id);
        expect(rows).toHaveLength(1);
        expect(rows[0].modeloUsado).toBe("nomic-embed-text");
    });

    it("actualiza vector y modelo cuando ya existe (una sola fila)", async () => {
        const reporte = await crearReporteDePrueba();
        const repo = new EmbeddingRepository();
        await repo.upsertReporteEmbedding(reporte.id, "modelo-viejo", vectorRelleno(0.1));
        await repo.upsertReporteEmbedding(reporte.id, "nomic-embed-text", vectorRelleno(0.9));

        const rows = await leerEmbedding(reporte.id);
        expect(rows).toHaveLength(1);
        expect(rows[0].modeloUsado).toBe("nomic-embed-text");
        expect(rows[0].vector).toContain("0.9");
        expect(rows[0].vector).not.toContain("0.1");
    });
});

describe("EmbeddingRepository (E-8 LOTE 4: búsquedas pgvector del motor)", () => {
    // SPEC-283: idem describe anterior — TAG compartido + numeroSeguimiento unique.
    beforeEach(async () => {
        await resetDatabase();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("buscarEjemplosSimilaresDataset: cercanos por encima del umbral, ordenados", async () => {
        const repo = new EmbeddingRepository();
        const dataset = await prisma.datasetEntrenamiento.create({
            data: { texto: "ejemplo conocido", clasificacionCorrecta: "OTRO", fuente: "correccion_admin", textoAnonimizado: true },
        });
        await repo.insertDatasetEmbedding(dataset.id, "nomic-embed-text", vectorRelleno(0.5));
        const lejano = await prisma.datasetEntrenamiento.create({
            data: { texto: "ejemplo lejano", clasificacionCorrecta: "DOXING", fuente: "correccion_admin", textoAnonimizado: true },
        });
        const vectorLejano = [...vectorRelleno(-0.5)];
        await repo.insertDatasetEmbedding(lejano.id, "nomic-embed-text", vectorLejano);

        const cercanos = await repo.buscarEjemplosSimilaresDataset(vectorRelleno(0.5), { topK: 3, umbral: 0.75 });
        expect(cercanos.map((r) => r.id)).toEqual([dataset.id]);
        expect(cercanos[0].similitud).toBeGreaterThan(0.99);
        expect(cercanos[0].clasificacionCorrecta).toBe("OTRO");

        const sinCandidatos = await repo.buscarEjemplosSimilaresDataset(vectorRelleno(0.5), { topK: 3, umbral: 1.01 });
        expect(sinCandidatos).toEqual([]);
    });

    it("buscarReporteSimilarPorEmbedding y buscarSimilitudMaximaPorEmbedding: mismo identificador+plataforma", async () => {
        const repo = new EmbeddingRepository();
        const origen = await crearReporteDePrueba();
        const gemelo = await prisma.reporte.create({
            data: {
                identificador: `+57300${TAG}`,
                plataformaId: origen.plataformaId,
                texto: "Otro texto de prueba para similitud con suficientes caracteres.",
                fechaIncidente: new Date("2026-07-11T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: `RPT-${TAG}-GEM`,
                estado: "CLASIFICADO",
            },
        });
        const otroIdentificador = await crearReporteDePrueba("-OTRO");
        // Mismo vector pero identificador distinto: no debe aparecer en los resultados.
        await prisma.reporte.update({
            where: { id: otroIdentificador.id },
            data: { identificador: `OTRO-${TAG}` },
        });
        await repo.upsertReporteEmbedding(origen.id, "nomic-embed-text", vectorRelleno(0.3));
        await repo.upsertReporteEmbedding(gemelo.id, "nomic-embed-text", vectorRelleno(0.3));
        await repo.upsertReporteEmbedding(otroIdentificador.id, "nomic-embed-text", vectorRelleno(0.3));

        const consulta = vectorRelleno(0.3);
        const similar = await repo.buscarReporteSimilarPorEmbedding(consulta, {
            reporteId: origen.id,
            identificador: `+57300${TAG}`,
            plataformaId: origen.plataformaId,
            threshold: 0.9,
        });
        // Encuentra el gemelo (mismo identificador), nunca el de otro identificador ni el propio.
        expect(similar).not.toBeNull();
        expect(similar!.reporteId).toBe(gemelo.id);
        expect(similar!.similarity).toBeGreaterThan(0.99);

        const sinUmbral = await repo.buscarReporteSimilarPorEmbedding(consulta, {
            reporteId: origen.id,
            identificador: `+57300${TAG}`,
            plataformaId: origen.plataformaId,
            threshold: 1.01,
        });
        expect(sinUmbral).toBeNull();

        const maxima = await repo.buscarSimilitudMaximaPorEmbedding(consulta, {
            reporteId: origen.id,
            identificador: `+57300${TAG}`,
            plataformaId: origen.plataformaId,
        });
        expect(maxima).toBeGreaterThan(0.99);

        const sinOtros = await repo.buscarSimilitudMaximaPorEmbedding(consulta, {
            reporteId: otroIdentificador.id,
            identificador: "identificador-sin-reportes",
            plataformaId: origen.plataformaId,
        });
        expect(sinOtros).toBeNull();
    });
});
