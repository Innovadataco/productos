import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { buscarClasificacionCache } from "./cache-semantico";

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

async function crearReporteBase(estado: "CLASIFICADO" | "CORREGIDO", identificador: string, numeroSeguimiento: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: "Texto de prueba para caché",
            fechaIncidente: new Date(),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento,
            estado,
        },
    });
}

async function crearClasificacionYCorreccion(reporteId: string, categoria: string, confirmada = true) {
    const admin = await crearUsuario("ADMIN");
    const clasificacion = await prisma.clasificacionIA.create({
        data: {
            reporteId,
            categoria: categoria as never,
            confianza: 0.95,
            modeloUsado: "rubrica:test",
            latenciaMs: 100,
        },
    });
    await prisma.correccionAdmin.create({
        data: {
            clasificacionId: clasificacion.id,
            categoriaOriginal: "SPAM" as never,
            categoriaCorregida: categoria as never,
            adminId: admin.id,
            confirmada,
        },
    });
    return clasificacion;
}

describe("cache semántico humano", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
    });

    it("devuelve hit cuando existe un CORREGIDO confirmado con embedding idéntico", async () => {
        const origen = await crearReporteBase("CORREGIDO", "+57300000001", "RPT-CACHE-01");
        await crearClasificacionYCorreccion(origen.id, "SOLICITUD_MATERIAL");
        await insertarEmbedding(origen.id, vector(768, 0.2));

        const result = await buscarClasificacionCache(vector(768, 0.2), {
            reporteIdActual: "otro-id",
            modeloEmbedding: "nomic-embed-text",
            similitudUmbral: 0.98,
            soloHumanoConfirmado: true,
        });

        expect(result.hit).toBe(true);
        if (result.hit) {
            expect(result.reporteOrigenId).toBe(origen.id);
            expect(result.categoria).toBe("SOLICITUD_MATERIAL");
            expect(result.confianza).toBeCloseTo(0.95);
            expect(result.similitud).toBeGreaterThanOrEqual(0.98);
        }
    });

    it("devuelve miss si no hay embedding suficientemente similar", async () => {
        const origen = await crearReporteBase("CORREGIDO", "+57300000002", "RPT-CACHE-02");
        await crearClasificacionYCorreccion(origen.id, "SOLICITUD_MATERIAL");
        await insertarEmbedding(origen.id, vector(768, 0.2));

        const result = await buscarClasificacionCache(vector(768, -0.2), {
            reporteIdActual: "otro-id",
            modeloEmbedding: "nomic-embed-text",
            similitudUmbral: 0.98,
            soloHumanoConfirmado: true,
        });

        expect(result.hit).toBe(false);
    });

    it("ignora correcciones no confirmadas", async () => {
        const origen = await crearReporteBase("CORREGIDO", "+57300000003", "RPT-CACHE-03");
        await crearClasificacionYCorreccion(origen.id, "SOLICITUD_MATERIAL", false);
        await insertarEmbedding(origen.id, vector(768, 0.2));

        const result = await buscarClasificacionCache(vector(768, 0.2), {
            reporteIdActual: "otro-id",
            modeloEmbedding: "nomic-embed-text",
            similitudUmbral: 0.98,
            soloHumanoConfirmado: true,
        });

        expect(result.hit).toBe(false);
    });

    it("acepta CLASIFICADO de alta confianza cuando soloHumanoConfirmado=false", async () => {
        const origen = await crearReporteBase("CLASIFICADO", "+57300000004", "RPT-CACHE-04");
        await prisma.clasificacionIA.create({
            data: {
                reporteId: origen.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.95,
                modeloUsado: "rubrica:test",
                latenciaMs: 100,
            },
        });
        await insertarEmbedding(origen.id, vector(768, 0.2));

        const result = await buscarClasificacionCache(vector(768, 0.2), {
            reporteIdActual: "otro-id",
            modeloEmbedding: "nomic-embed-text",
            similitudUmbral: 0.98,
            soloHumanoConfirmado: false,
        });

        expect(result.hit).toBe(true);
        if (result.hit) {
            expect(result.categoria).toBe("CONTACTO_INSISTENTE");
        }
    });

    it("rechaza CLASIFICADO cuando soloHumanoConfirmado=true", async () => {
        const origen = await crearReporteBase("CLASIFICADO", "+57300000005", "RPT-CACHE-05");
        await prisma.clasificacionIA.create({
            data: {
                reporteId: origen.id,
                categoria: "CONTACTO_INSISTENTE",
                confianza: 0.95,
                modeloUsado: "rubrica:test",
                latenciaMs: 100,
            },
        });
        await insertarEmbedding(origen.id, vector(768, 0.2));

        const result = await buscarClasificacionCache(vector(768, 0.2), {
            reporteIdActual: "otro-id",
            modeloEmbedding: "nomic-embed-text",
            similitudUmbral: 0.98,
            soloHumanoConfirmado: true,
        });

        expect(result.hit).toBe(false);
    });

    it("excluye el reporte actual de la búsqueda", async () => {
        const origen = await crearReporteBase("CORREGIDO", "+57300000006", "RPT-CACHE-06");
        await crearClasificacionYCorreccion(origen.id, "SOLICITUD_MATERIAL");
        await insertarEmbedding(origen.id, vector(768, 0.2));

        const result = await buscarClasificacionCache(vector(768, 0.2), {
            reporteIdActual: origen.id,
            modeloEmbedding: "nomic-embed-text",
            similitudUmbral: 0.98,
            soloHumanoConfirmado: true,
        });

        expect(result.hit).toBe(false);
    });
});
