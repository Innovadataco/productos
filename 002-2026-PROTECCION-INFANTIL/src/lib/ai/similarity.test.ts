import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { buscarReporteSimilar } from "./similarity";

function vector(dimension: number, value: number) {
    return new Array(dimension).fill(value);
}

async function insertarEmbedding(reporteId: string, modeloUsado = "nomic-embed-text", values: number[]) {
    const vectorStr = "[" + values.join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${reporteId}, ${vectorStr}::vector, ${modeloUsado}, NOW())
    `;
}

describe("buscarReporteSimilar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("encuentra reporte similar para el mismo identificador y plataforma", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const [origen, candidato] = await Promise.all([
            prisma.reporte.create({
                data: {
                    identificador: "+573001234567",
                    plataformaId: plataforma!.id,
                    texto: "Texto base",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-SIM-01",
                    estado: "CLASIFICADO",
                },
            }),
            prisma.reporte.create({
                data: {
                    identificador: "+573001234567",
                    plataformaId: plataforma!.id,
                    texto: "Texto muy similar",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-SIM-02",
                    estado: "PENDIENTE",
                },
            }),
        ]);

        await insertarEmbedding(origen.id, "nomic-embed-text", vector(768, 0.1));
        await insertarEmbedding(candidato.id, "nomic-embed-text", vector(768, 0.1));

        const similar = await buscarReporteSimilar(candidato.id, "+573001234567", plataforma!.id, vector(768, 0.1), 0.92);

        expect(similar).not.toBeNull();
        expect(similar?.reporteId).toBe(origen.id);
        expect(similar?.similarity).toBeGreaterThanOrEqual(0.92);
    });

    it("ignora reportes de otro identificador", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const [otro, candidato] = await Promise.all([
            prisma.reporte.create({
                data: {
                    identificador: "+573009999999",
                    plataformaId: plataforma!.id,
                    texto: "Texto",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-DIFF-01",
                    estado: "CLASIFICADO",
                },
            }),
            prisma.reporte.create({
                data: {
                    identificador: "+573001234567",
                    plataformaId: plataforma!.id,
                    texto: "Texto",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-DIFF-02",
                    estado: "PENDIENTE",
                },
            }),
        ]);

        await insertarEmbedding(otro.id, "nomic-embed-text", vector(768, 0.1));
        await insertarEmbedding(candidato.id, "nomic-embed-text", vector(768, 0.1));

        const similar = await buscarReporteSimilar(candidato.id, "+573001234567", plataforma!.id, vector(768, 0.1), 0.92);
        expect(similar).toBeNull();
    });

    it("ignora reportes marcados como DUPLICADO o POSIBLE_SPAM", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const [duplicado, spam, candidato] = await Promise.all([
            prisma.reporte.create({
                data: {
                    identificador: "+573001234567",
                    plataformaId: plataforma!.id,
                    texto: "Texto",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-EXC-01",
                    estado: "DUPLICADO",
                },
            }),
            prisma.reporte.create({
                data: {
                    identificador: "+573001234567",
                    plataformaId: plataforma!.id,
                    texto: "Texto",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-EXC-02",
                    estado: "POSIBLE_SPAM",
                },
            }),
            prisma.reporte.create({
                data: {
                    identificador: "+573001234567",
                    plataformaId: plataforma!.id,
                    texto: "Texto",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: "RPT-EXC-03",
                    estado: "PENDIENTE",
                },
            }),
        ]);

        await insertarEmbedding(duplicado.id, "nomic-embed-text", vector(768, 0.1));
        await insertarEmbedding(spam.id, "nomic-embed-text", vector(768, 0.1));
        await insertarEmbedding(candidato.id, "nomic-embed-text", vector(768, 0.1));

        const similar = await buscarReporteSimilar(candidato.id, "+573001234567", plataforma!.id, vector(768, 0.1), 0.92);
        expect(similar).toBeNull();
    });
});
