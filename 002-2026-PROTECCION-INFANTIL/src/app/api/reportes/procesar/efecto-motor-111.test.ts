/**
 * SPEC-111 (D-28) — test de EFECTO del parámetro ia.rubrica.enabled (I-14/I-20):
 * no prueba que el parámetro existe, prueba qué motor clasifica.
 * enabled=true  → el pipeline usa la RÚBRICA y persiste ClasificacionRubricaVoto.
 * enabled=false → el pipeline usa LEGACY y NO persiste votos de rúbrica.
 * `cargarConfigRubrica` va REAL (lee el parámetro de la BD de test); los modelos van mockeados.
 */
import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

const mockClasificarConVotos = vi.fn();
const mockClasificarConRubrica = vi.fn();
const mockEmbedding = vi.fn();
const mockPii = vi.fn();
const mockAnonimizar = vi.fn();
const mockEnviarAlertaRevision = vi.fn();

vi.mock("@/lib/ai/classifier", () => ({
    clasificarConVotos: (...args: unknown[]) => mockClasificarConVotos(...args),
}));

vi.mock("@/lib/ai/rubrica", async (importOriginal) => {
    const original = await importOriginal<typeof import("@/lib/ai/rubrica")>();
    return {
        ...original, // cargarConfigRubrica REAL: lee ia.rubrica.enabled de la BD de test
        clasificarConRubrica: (...args: unknown[]) => mockClasificarConRubrica(...args),
    };
});

vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: (...args: unknown[]) => mockEmbedding(...args),
}));

vi.mock("@/lib/ai/pii-detector", () => ({
    detectarPiiCombinado: (...args: unknown[]) => mockPii(...args),
}));

vi.mock("@/lib/ai/anonimizador", () => ({
    anonimizarTexto: (...args: unknown[]) => mockAnonimizar(...args),
}));

vi.mock("@/lib/email", () => ({
    enviarAlertaRevision: (...args: unknown[]) => mockEnviarAlertaRevision(...args),
    enviarAlertaScoreCritico: async () => undefined,
    enviarAlertasSuscriptores: async () => undefined,
}));

const RESULTADO_RUBRICA = {
    categoria: "SOLICITUD_MATERIAL" as CategoriaConducta,
    confianza: 1,
    categoriasSecundarias: [],
    estado: "CLASIFICADO" as const,
    metrics: { modelo: "rubrica:test", latenciaMs: 10, promptTokens: 1, responseTokens: 1 },
    rawResponse: "{}",
    votosModelos: [
        { modelo: "gemma2:27b", categorias: { SOLICITUD_MATERIAL: { cumple: true, preguntasCumplidas: ["¿Alguien pide fotos?"] } } },
        { modelo: "qwen2.5:14b", categorias: { SOLICITUD_MATERIAL: { cumple: true, preguntasCumplidas: ["¿Alguien pide fotos?"] } } },
    ],
};

const RESULTADO_LEGACY = {
    categoria: "SOLICITUD_MATERIAL" as CategoriaConducta,
    confianza: 0.9,
    categoriasSecundarias: [],
    posibleAgresorPar: false,
    estado: "CLASIFICADO" as const,
    rawResponse: "{}",
    metrics: { modelo: "ornith:9b", latenciaMs: 10, promptTokens: 1, responseTokens: 1 },
    fallback: false,
    votos: [],
};

async function crearReporte(numero: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    return prisma.reporte.create({
        data: {
            identificador: "+57300999000" + numero,
            plataformaId: plataforma!.id,
            texto: "Un adulto le pide fotos íntimas a mi hija de 13 años a cambio de dinero.",
            fechaIncidente: new Date("2026-07-10T14:30:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: true,
            numeroSeguimiento: `RPT-111-${numero}`,
            estado: "PENDIENTE",
        },
    });
}

function reqProcesar(reporteId: string) {
    return new Request("http://localhost:5005/api/reportes/procesar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-worker-secret": process.env.WORKER_SECRET || "worker-secret-test" },
        body: JSON.stringify({ reporteId }),
    });
}

async function fijarEnabled(valor: boolean) {
    await prisma.parametroSistema.upsert({
        where: { clave: "ia.rubrica.enabled" },
        update: { valor: String(valor) },
        create: { clave: "ia.rubrica.enabled", valor: String(valor), tipo: "BOOLEAN", categoria: "SYSTEM", esPublico: false },
    });
}

let valorOriginal: string | null = null;

describe("SPEC-111 — efecto del parámetro ia.rubrica.enabled sobre el motor que clasifica", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        const actual = await prisma.parametroSistema.findUnique({ where: { clave: "ia.rubrica.enabled" } });
        valorOriginal = actual?.valor ?? "false";

        mockClasificarConVotos.mockReset().mockResolvedValue(RESULTADO_LEGACY);
        mockClasificarConRubrica.mockReset().mockResolvedValue(RESULTADO_RUBRICA);
        mockEmbedding.mockReset().mockResolvedValue(new Array(768).fill(0.1));
        mockPii.mockReset().mockResolvedValue({
            contienePii: false,
            contienePiiDeterministico: false,
            contienePiiLLM: false,
            piiDetectada: [],
            piiDetectadaDeterministico: [],
            piiDetectadaLLM: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        mockAnonimizar.mockReset();
        mockEnviarAlertaRevision.mockReset().mockResolvedValue(undefined);
        process.env.WORKER_SECRET = "worker-secret-test";
    });

    afterAll(async () => {
        // Deja la BD de test como se encontró (regla del instructivo: dejar la BD como estaba)
        await fijarEnabled(valorOriginal === "true");
    });

    it("enabled=true → clasifica POR RÚBRICA (llama al motor rúbrica, NO al legacy, y persiste ClasificacionRubricaVoto)", async () => {
        await fijarEnabled(true);
        const reporte = await crearReporte("T1");

        const res = await POST(reqProcesar(reporte.id));
        expect(res.status).toBe(200);

        expect(mockClasificarConRubrica, "debe llamarse el motor rúbrica").toHaveBeenCalledTimes(1);
        expect(mockClasificarConVotos, "NO debe llamarse el motor legacy").not.toHaveBeenCalled();

        const clasif = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        const votos = await prisma.clasificacionRubricaVoto.findMany({ where: { clasificacionIAId: clasif!.id } });
        expect(votos.length, "la rúbrica debe persistir sus votos").toBeGreaterThan(0);
        expect(votos.map((v) => v.modelo).sort()).toEqual(["gemma2:27b", "qwen2.5:14b"]);
    });

    it("enabled=false → clasifica POR LEGACY (llama al legacy, NO a la rúbrica, y NO hay votos de rúbrica)", async () => {
        await fijarEnabled(false);
        const reporte = await crearReporte("T2");

        const res = await POST(reqProcesar(reporte.id));
        expect(res.status).toBe(200);

        expect(mockClasificarConVotos, "debe llamarse el motor legacy").toHaveBeenCalledTimes(1);
        expect(mockClasificarConRubrica, "NO debe llamarse el motor rúbrica").not.toHaveBeenCalled();

        const clasif = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        const votos = await prisma.clasificacionRubricaVoto.findMany({ where: { clasificacionIAId: clasif!.id } });
        expect(votos.length, "legacy no genera votos de rúbrica").toBe(0);
    });
});
