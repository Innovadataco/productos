import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";

vi.mock("@/lib/ai/ollama-config", () => ({
    listOllamaModels: vi.fn().mockResolvedValue([
        { name: "ornith", tag: "9b", size: 1000, esEmbedding: false },
    ]),
    getOllamaBaseUrl: vi.fn().mockResolvedValue("http://localhost:11434"),
}));

vi.mock("pg-boss", () => ({
    PgBoss: vi.fn().mockImplementation(() => ({
        start: vi.fn().mockResolvedValue(undefined),
        send: vi.fn().mockResolvedValue(undefined),
        stop: vi.fn().mockResolvedValue(undefined),
    })),
}));

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

describe("POST /api/admin/ia/experimentos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParams();
    });

    it("creates an experiment with config snapshot and enqueues a job", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.casoEval.create({
            data: { texto: "caso A", categoriaEsperada: "OTRO", ruido: false, fuente: "SEMILLA", activo: true, fixtureVersion: 1 },
        });

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/experimentos", {
            nombre: "Experimento base",
            notas: "corrida de prueba",
            config: { nVotos: 3 },
        });

        const res = await POST(req);
        expect(res.status).toBe(202);
        const body = await res.json();
        expect(body.runId).toBeDefined();

        const run = await prisma.evalRun.findUnique({ where: { id: body.runId } });
        expect(run).not.toBeNull();
        expect(run?.nombre).toBe("Experimento base");
        expect(run?.configSnapshot).toMatchObject({ nVotos: 3, modeloClasificacion: "ornith:9b" });

        const audit = await prisma.auditLog.findFirst({ where: { accion: "EXPERIMENT_START" } });
        expect(audit).not.toBeNull();
    });

    it("rejects a model not installed", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.casoEval.create({
            data: { texto: "caso A", categoriaEsperada: "OTRO", ruido: false, fuente: "SEMILLA", activo: true, fixtureVersion: 1 },
        });

        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/experimentos", {
            nombre: "Experimento inválido",
            config: { modeloClasificacion: "no-existe:9b" },
        });

        const res = await POST(req);
        expect(res.status).toBe(400);
    });
});

describe("GET /api/admin/ia/experimentos", () => {
    beforeEach(async () => {
        await resetDatabase();
        await seedParams();
    });

    it("lists experiments", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        await prisma.evalRun.create({
            data: {
                tipo: "f7",
                fixtureVersion: 1,
                estado: "COMPLETADA",
                nombre: "Exp 1",
                configSnapshot: { modeloClasificacion: "ornith:9b" } as never,
            },
        });

        const req = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/experimentos", null);
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(1);
    });

    it("refleja el estado actual de BD sin cachear valores anteriores", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);

        const run = await prisma.evalRun.create({
            data: {
                tipo: "f7",
                fixtureVersion: 1,
                estado: "EN_PROGRESO",
                nombre: "Exp cache test",
                progresoCasos: 0,
                progresoTotal: 110,
                configSnapshot: { modeloClasificacion: "ornith:9b" } as never,
            },
        });

        const req1 = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/experimentos", null);
        const res1 = await GET(req1);
        const body1 = await res1.json();
        expect(body1.items[0].estado).toBe("EN_PROGRESO");

        await prisma.evalRun.update({
            where: { id: run.id },
            data: {
                estado: "COMPLETADA",
                progresoCasos: 110,
                finalizadoEn: new Date(),
                resultadoJson: {
                    metrics: {
                        accuracy: 0.85,
                        errorSilencioso: 0.05,
                        revisionManualRate: 0.1,
                    },
                } as never,
            },
        });

        const req2 = crearRequestAutenticado("GET", "http://localhost/api/admin/ia/experimentos", null);
        const res2 = await GET(req2);
        const body2 = await res2.json();
        expect(body2.items[0].estado).toBe("COMPLETADA");
        expect(body2.items[0].progresoCasos).toBe(110);
        expect(body2.items[0].resultadoJson).toBeDefined();
    });
});
