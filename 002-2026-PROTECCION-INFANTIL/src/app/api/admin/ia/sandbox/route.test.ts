import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";
import * as auth from "@/lib/auth";
import { AppError, ERROR_CODES } from "@/lib/errors";
import type { CategoriaConducta } from "@prisma/client";

const mockEmbedding = vi.fn();
const mockRag = vi.fn();
const mockVotos = vi.fn();
const mockPii = vi.fn();
const mockAnonimizar = vi.fn();

vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: (...args: unknown[]) => mockEmbedding(...args),
}));

vi.mock("@/lib/ai/dataset-retrieval", () => ({
    buscarEjemplosSimilares: (...args: unknown[]) => mockRag(...args),
}));

vi.mock("@/lib/ai/classifier", () => ({
    clasificarConVotos: (...args: unknown[]) => mockVotos(...args),
}));

vi.mock("@/lib/ai/pii-detector", () => ({
    detectarPiiCombinado: (...args: unknown[]) => mockPii(...args),
}));

vi.mock("@/lib/ai/anonimizador", () => ({
    anonimizarTexto: (...args: unknown[]) => mockAnonimizar(...args),
}));

function baseClasificacion(categoria: CategoriaConducta, confianza: number, estado: string) {
    return {
        categoria,
        confianza,
        categoriasSecundarias: [],
        posibleAgresorPar: false,
        estado,
        rawResponse: "{}",
        metrics: { modelo: "ornith:9b", latenciaMs: 100, promptTokens: 50, responseTokens: 20 },
        fallback: false,
        votos: Array.from({ length: 5 }, () => ({ categoria, confianza, posibleAgresorPar: false })),
    };
}

describe("POST /api/admin/ia/sandbox", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        vi.spyOn(auth, "verifyAuth").mockReset().mockRejectedValue(
            new AppError("No autenticado", ERROR_CODES.AUTH_INVALID, 401)
        );
        mockEmbedding.mockReset().mockResolvedValue(new Array(768).fill(0.1));
        mockRag.mockReset().mockResolvedValue([]);
        mockVotos.mockReset().mockResolvedValue(baseClasificacion("EXTORSION", 1.0, "CLASIFICADO"));
        mockPii.mockReset().mockResolvedValue({
            contienePii: false,
            contienePiiDeterministico: false,
            contienePiiLLM: false,
            piiDetectada: [],
            piiDetectadaDeterministica: [],
            piiDetectadaLLM: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        mockAnonimizar.mockReset().mockResolvedValue({
            textoAnonimizado: "texto anonimizado",
            piiDetectada: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0 },
        });
    });

    it("rechaza request sin autenticación", async () => {
        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/sandbox", { texto: "prueba" });
        const res = await POST(req);
        expect(res.status).toBe(401);
    });

    it("rechaza request de usuario no admin", async () => {
        await crearUsuario("PARENT");
        vi.spyOn(auth, "verifyAuth").mockRejectedValue(
            new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403)
        );
        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/sandbox", { texto: "prueba" });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it("devuelve trace sandbox para admin", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/sandbox", { texto: "prueba" });
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.comparar).toBe(false);
        expect(body.trace.decision.categoria).toBe("EXTORSION");
        expect(body.trace.decision.estado).toBe("CLASIFICADO");
        expect(body.trace.etapas.votacion.confianza).toBe(1.0);
        expect(mockEmbedding).toHaveBeenCalled();
    });

    it("aplica overrides y refleja parámetros efectivos", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const req = crearRequestAutenticado(
            "POST",
            "http://localhost/api/admin/ia/sandbox",
            { texto: "prueba", parametrosOverride: { umbral_revision: 0.8, n_votos: 3, rag_top_k: 2 } }
        );
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.trace.parametrosEfectivos.umbralRevision).toBe(0.8);
        expect(body.trace.parametrosEfectivos.nVotos).toBe(3);
        expect(body.trace.parametrosEfectivos.ragTopK).toBe(2);
    });

    it("modo comparar devuelve baseline y override", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        mockVotos
            .mockResolvedValueOnce(baseClasificacion("EXTORSION", 1.0, "CLASIFICADO"))
            .mockResolvedValueOnce(baseClasificacion("OTRO", 0.6, "REVISION_MANUAL"));
        const req = crearRequestAutenticado(
            "POST",
            "http://localhost/api/admin/ia/sandbox",
            { texto: "prueba", comparar: true, parametrosOverride: { umbral_revision: 0.5 } }
        );
        const res = await POST(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.comparar).toBe(true);
        expect(body.baseline.decision.categoria).toBe("EXTORSION");
        expect(body.override.decision.categoria).toBe("OTRO");
        expect(body.diferencias.estadoCambio).toBe(true);
        expect(body.diferencias.categoriaCambio).toBe(true);
    });

    it("no persiste reportes en la base de datos", async () => {
        const admin = await crearUsuario("ADMIN");
        vi.spyOn(auth, "verifyAuth").mockResolvedValue(admin);
        const before = await prisma.reporte.count();
        const req = crearRequestAutenticado("POST", "http://localhost/api/admin/ia/sandbox", { texto: "prueba" });
        await POST(req);
        const after = await prisma.reporte.count();
        expect(after).toBe(before);
    });
});
