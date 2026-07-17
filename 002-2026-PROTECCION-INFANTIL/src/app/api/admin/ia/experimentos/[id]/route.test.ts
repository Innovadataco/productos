import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

async function seedParams() {
    await prisma.parametroSistema.createMany({
        data: [
            { clave: "reportes.classification_model", valor: "ornith:9b", tipo: "STRING", categoria: "SECURITY", esPublico: false },
            { clave: "reportes.embedding_model", valor: "nomic-embed-text", tipo: "STRING", categoria: "SECURITY", esPublico: false },
            { clave: "reportes.classification.umbral_revision", valor: "1.0", tipo: "FLOAT", categoria: "SECURITY", esPublico: false },
            { clave: "reportes.classification.n_votos", valor: "5", tipo: "INTEGER", categoria: "SECURITY", esPublico: false },
            { clave: "reportes.classification.temperatura_votos", valor: "0.7", tipo: "FLOAT", categoria: "SECURITY", esPublico: false },
            { clave: "reportes.classification.rag_top_k", valor: "3", tipo: "INTEGER", categoria: "SECURITY", esPublico: false },
            { clave: "system.ollama_base_url", valor: "http://localhost:11434", tipo: "STRING", categoria: "SYSTEM", esPublico: false },
        ],
    });
}

const productionConfigSnapshot = {
    modeloClasificacion: "ornith:9b",
    modeloEmbedding: "nomic-embed-text",
    umbralRevision: 1.0,
    nVotos: 5,
    temperaturaVotos: 0.7,
    ragTopK: 3,
    ollamaBaseUrl: "http://localhost:11434",
    fixtureVersion: 1,
};

describe("GET /api/admin/ia/experimentos/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParams();
    });

    it("devuelve métricas y baseline cuando el experimento está completado", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const baseline = await prisma.evalRun.create({
            data: {
                tipo: "f7",
                fixtureVersion: 1,
                estado: "COMPLETADA",
                nombre: "Baseline",
                configSnapshot: productionConfigSnapshot as never,
                finalizadoEn: new Date(),
                resultadoJson: {
                    metrics: {
                        accuracy: 0.8,
                        precisionAutoClasificados: 0.85,
                        errorSilencioso: 0.1,
                        revisionManualRate: 0.15,
                        latencyP50Ms: 1000,
                        latencyP95Ms: 2000,
                        posibleAgresorParRate: 0.2,
                        recallOTRO: 0.75,
                    },
                } as never,
            },
        });

        const experiment = await prisma.evalRun.create({
            data: {
                tipo: "f7",
                fixtureVersion: 1,
                estado: "COMPLETADA",
                nombre: "qwen2.5:32b . prueba 1",
                configSnapshot: { ...productionConfigSnapshot, modeloClasificacion: "qwen2.5:32b", nVotos: 3 } as never,
                finalizadoEn: new Date(),
                progresoCasos: 110,
                progresoTotal: 110,
                resultadoJson: {
                    metrics: {
                        accuracy: 0.85,
                        precisionAutoClasificados: 0.9,
                        errorSilencioso: 0.05,
                        revisionManualRate: 0.1,
                        latencyP50Ms: 1200,
                        latencyP95Ms: 2400,
                        posibleAgresorParRate: 0.15,
                        recallOTRO: 0.8,
                    },
                    perCategory: {
                        OTRO: { precision: 0.9, recall: 0.8, f1: 0.85, support: 10 },
                    },
                    operational: {
                        duracionTotalMs: 60000,
                        casosPorMinuto: 110,
                        tasaFallbacks: 0,
                        activacionesGuardas: 0,
                        doxingVerdaderas: 0,
                        keywordsActivadas: 0,
                        prioridadAltaTotal: 0,
                    },
                } as never,
            },
        });

        const req = crearRequestAutenticado("GET", `http://localhost/api/admin/ia/experimentos/${experiment.id}`, null);
        const res = await GET(req, { params: Promise.resolve({ id: experiment.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.experimento.estado).toBe("COMPLETADA");
        expect(body.experimento.progresoCasos).toBe(110);
        expect(body.metrics).toBeDefined();
        expect(body.metrics.accuracy).toBe(0.85);
        expect(body.baseline).not.toBeNull();
        expect(body.baseline.id).toBe(baseline.id);
        expect(body.baseline.metrics.accuracy).toBe(0.8);
        expect(body.perCategory).toBeDefined();
        expect(body.operational).toBeDefined();
        expect(body.baselineMissing).toBe(false);
    });
});
