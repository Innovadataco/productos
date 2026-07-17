import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import { procesarBackfillAnonimizacion } from "@/lib/ai/dataset-anonimizacion-backfill";
import { procesarBackfillEmbedding } from "@/lib/ai/dataset-embedding-backfill";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

const mockAnonimizar = vi.fn();
const mockPublishBackfill = vi.fn().mockResolvedValue(undefined);
const mockPublishEmbeddingBackfill = vi.fn().mockResolvedValue(undefined);
const mockGenerarEmbedding = vi.fn().mockResolvedValue(new Array(768).fill(0.01));

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/ai/anonimizador", () => ({
    anonimizarTexto: (...args: unknown[]) => mockAnonimizar(...args),
}));

vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: (...args: unknown[]) => mockGenerarEmbedding(...args),
}));

vi.mock("@/lib/queue", () => ({
    publishDatasetAnonimizacionBackfill: (...args: unknown[]) => mockPublishBackfill(...args),
    publishDatasetEmbeddingBackfill: (...args: unknown[]) => mockPublishEmbeddingBackfill(...args),
}));

describe("POST /api/admin/correcciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
        mockAnonimizar.mockReset();
        mockPublishBackfill.mockReset().mockResolvedValue(undefined);
        mockPublishEmbeddingBackfill.mockReset().mockResolvedValue(undefined);
        mockGenerarEmbedding.mockReset().mockResolvedValue(new Array(768).fill(0.01));
    });

    async function setupReporteConPii() {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const usuario = await crearUsuario("PARENT");
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300CORRECCION",
                plataformaId: plataforma!.id,
                usuarioId: usuario.id,
                texto: "Mi hija María del colegio San José recibió mensajes ofreciendo regalos.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-CORR001",
                estado: "CLASIFICADO",
            },
        });
        const clasificacion = await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
                confianza: 0.85,
                contienePii: true,
                piiDetectada: ["María", "colegio San José"],
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        return { reporte, clasificacion };
    }

    it("guarda dataset anonimizado cuando la anonimización sincrónica funciona", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupReporteConPii();

        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija [NOMBRE] del [COLEGIO] recibió mensajes ofreciendo regalos.",
            piiDetectada: ["María", "colegio San José"],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(200);

        const dataset = await prisma.datasetEntrenamiento.findFirst({
            where: { fuente: "correccion_admin" },
        });
        expect(dataset).not.toBeNull();
        expect(dataset!.textoAnonimizado).toBe(true);
        expect(dataset!.texto).toContain("[NOMBRE]");
        expect(mockPublishBackfill).not.toHaveBeenCalled();

        const embedding = await prisma.embeddingDataset.findUnique({
            where: { datasetId: dataset!.id },
        });
        expect(embedding).not.toBeNull();
        expect(mockPublishEmbeddingBackfill).not.toHaveBeenCalled();
    });

    it("encola backfill cuando la anonimización sincrónica falla y el backfill anonimiza el registro", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupReporteConPii();

        // Primera llamada (corrección sincrónica) falla.
        mockAnonimizar.mockRejectedValueOnce(new Error("Ollama no disponible"));

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(200);

        const dataset = await prisma.datasetEntrenamiento.findFirst({
            where: { fuente: "correccion_admin" },
        });
        expect(dataset).not.toBeNull();
        expect(dataset!.textoAnonimizado).toBe(false);
        expect(dataset!.texto).toContain("María");
        expect(mockPublishBackfill).toHaveBeenCalledWith(dataset!.id);

        // Simular que el worker reintenta y ahora Ollama responde.
        mockAnonimizar.mockResolvedValueOnce({
            textoAnonimizado: "Mi hija [NOMBRE] del [COLEGIO] recibió mensajes ofreciendo regalos.",
            piiDetectada: ["María", "colegio San José"],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });

        await procesarBackfillAnonimizacion(dataset!.id);

        const datasetActualizado = await prisma.datasetEntrenamiento.findUnique({
            where: { id: dataset!.id },
        });
        expect(datasetActualizado!.textoAnonimizado).toBe(true);
        expect(datasetActualizado!.texto).toContain("[NOMBRE]");
        expect(datasetActualizado!.texto).not.toContain("María");
    });

    it("encola backfill de embedding cuando el embedding sincrónico falla", async () => {
        const admin = await crearUsuario("ADMIN");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { reporte } = await setupReporteConPii();

        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija [NOMBRE] del [COLEGIO] recibió mensajes ofreciendo regalos.",
            piiDetectada: ["María", "colegio San José"],
            metrics: { modelo: "ornith:9b", latenciaMs: 500 },
        });
        mockGenerarEmbedding.mockRejectedValueOnce(new Error("Ollama no disponible"));

        const req = crearRequestAutenticado("POST", "http://localhost:5005/api/admin/correcciones", {
            reporteId: reporte.id,
            categoriaCorregida: "SOLICITUD_ENCUENTRO",
        }, mockToken);

        const res = await POST(req);
        expect(res.status).toBe(200);

        const dataset = await prisma.datasetEntrenamiento.findFirst({
            where: { fuente: "correccion_admin" },
        });
        expect(dataset).not.toBeNull();
        expect(mockPublishEmbeddingBackfill).toHaveBeenCalledWith(dataset!.id);

        // Simular worker de backfill de embedding
        mockGenerarEmbedding.mockResolvedValueOnce(new Array(768).fill(0.02));
        await procesarBackfillEmbedding(dataset!.id);

        const embedding = await prisma.embeddingDataset.findUnique({
            where: { datasetId: dataset!.id },
        });
        expect(embedding).not.toBeNull();
    });
});
