import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import { detectarPatronCoordinado } from "./patron-coordinado";

function vector(dimension: number, value: number) {
    return new Array(dimension).fill(value);
}

async function insertarEmbedding(reporteId: string, values: number[], modeloUsado = "nomic-embed-text") {
    const vectorStr = "[" + values.join(",") + "]";
    await prisma.$executeRaw`
        INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
        VALUES (${crypto.randomUUID()}, ${reporteId}, ${vectorStr}::vector, ${modeloUsado}, NOW())
    `;
}

describe("patrón coordinado", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("detecta coordinación cuando 5+ identificadores distintos reciben texto similar", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporteIds: string[] = [];
        for (let i = 0; i < 5; i++) {
            const r = await prisma.reporte.create({
                data: {
                    identificador: `+5730000000${i}`,
                    plataformaId: plataforma!.id,
                    texto: "Texto coordinado de prueba",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: `RPT-PAT-${i}`,
                    estado: "CLASIFICADO",
                },
            });
            reporteIds.push(r.id);
            await insertarEmbedding(r.id, vector(768, 0.5));
        }

        const candidato = await prisma.reporte.create({
            data: {
                identificador: "+57300000999",
                plataformaId: plataforma!.id,
                texto: "Texto coordinado de prueba",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-PAT-99",
                estado: "PENDIENTE",
            },
        });

        const result = await detectarPatronCoordinado(candidato.id, vector(768, 0.5), {
            minReportes: 5,
            ventanaMin: 60,
            similitudUmbral: 0.9,
            modeloEmbedding: "nomic-embed-text",
        });

        expect(result.coordinado).toBe(true);
        if (result.coordinado) {
            expect(result.count).toBeGreaterThanOrEqual(5);
            expect(result.reportesRelacionadosIds.length).toBeGreaterThanOrEqual(5);
            expect(result.similitudPromedio).toBeGreaterThanOrEqual(0.9);
        }
    });

    it("no detecta patrón con menos de 5 identificadores distintos", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 3; i++) {
            const r = await prisma.reporte.create({
                data: {
                    identificador: `+5730000000${i}`,
                    plataformaId: plataforma!.id,
                    texto: "Otro texto coordinado",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: `RPT-PAT2-${i}`,
                    estado: "CLASIFICADO",
                },
            });
            await insertarEmbedding(r.id, vector(768, 0.5));
        }

        const candidato = await prisma.reporte.create({
            data: {
                identificador: "+57300000999",
                plataformaId: plataforma!.id,
                texto: "Otro texto coordinado",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-PAT2-99",
                estado: "PENDIENTE",
            },
        });

        const result = await detectarPatronCoordinado(candidato.id, vector(768, 0.5), {
            minReportes: 5,
            ventanaMin: 60,
            similitudUmbral: 0.9,
            modeloEmbedding: "nomic-embed-text",
        });

        expect(result.coordinado).toBe(false);
    });

    it("ignora reportes fuera de la ventana de tiempo", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        for (let i = 0; i < 5; i++) {
            const r = await prisma.reporte.create({
                data: {
                    identificador: `+5730000000${i}`,
                    plataformaId: plataforma!.id,
                    texto: "Texto viejo",
                    fechaIncidente: new Date(),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: true,
                    numeroSeguimiento: `RPT-OLD-${i}`,
                    estado: "CLASIFICADO",
                    creadoEn: new Date(Date.now() - 2 * 60 * 60 * 1000),
                },
            });
            await insertarEmbedding(r.id, vector(768, 0.5));
        }

        const candidato = await prisma.reporte.create({
            data: {
                identificador: "+57300000999",
                plataformaId: plataforma!.id,
                texto: "Texto viejo",
                fechaIncidente: new Date(),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-OLD-99",
                estado: "PENDIENTE",
            },
        });

        const result = await detectarPatronCoordinado(candidato.id, vector(768, 0.5), {
            minReportes: 5,
            ventanaMin: 60,
            similitudUmbral: 0.9,
            modeloEmbedding: "nomic-embed-text",
        });

        expect(result.coordinado).toBe(false);
    });
});
