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

async function crearReporteDePrueba() {
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
            numeroSeguimiento: `RPT-${TAG}`,
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
