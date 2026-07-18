import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

const mockClasificar = vi.fn();
const mockPii = vi.fn();
const mockEmbedding = vi.fn();
const mockAnonimizar = vi.fn();
const mockEnviarAlertaRevision = vi.fn();
const mockEnviarAlertaScoreCritico = vi.fn();
const mockEnviarAlertasSuscriptores = vi.fn();

vi.mock("@/lib/ai/classifier", () => ({
    clasificarConVotos: (...args: unknown[]) => mockClasificar(...args),
}));

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
    enviarAlertaScoreCritico: (...args: unknown[]) => mockEnviarAlertaScoreCritico(...args),
    enviarAlertasSuscriptores: (...args: unknown[]) => mockEnviarAlertasSuscriptores(...args),
}));

function crearRequestProcesar(reporteId: string) {
    return new Request("http://localhost:5005/api/reportes/procesar", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-worker-secret": process.env.WORKER_SECRET || "worker-secret-test" },
        body: JSON.stringify({ reporteId }),
    });
}

describe("POST /api/reportes/procesar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockClasificar.mockReset();
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
        mockEmbedding.mockReset();
        mockAnonimizar.mockReset();
        mockEnviarAlertaRevision.mockReset().mockResolvedValue(undefined);
        mockEnviarAlertaScoreCritico.mockReset().mockResolvedValue(undefined);
        mockEnviarAlertasSuscriptores.mockReset().mockResolvedValue(undefined);
        process.env.WORKER_SECRET = "worker-secret-test";
    });

    it("rechaza request sin worker secret", async () => {
        const req = new Request("http://localhost:5005/api/reportes/procesar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reporteId: "cmr-fake" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it("clasifica un reporte y actualiza estado a CLASIFICADO", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+573001234567",
                plataformaId: plataforma!.id,
                texto: "Este número contactó a mi hija ofreciendo regalos.",
                fechaIncidente: new Date("2026-07-10T14:30:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-ABC123",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.92,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1200, promptTokens: 100, responseTokens: 20 },
            fallback: false,
            votos: [{ categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta, confianza: 0.92, posibleAgresorPar: false }],
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("CLASIFICADO");
        expect(body.clasificacion.categoria).toBe("OFRECIMIENTO_REGALOS");

        const clasif = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(clasif?.categoria).toBe("OFRECIMIENTO_REGALOS");
    });

    it("anonimiza reporte con PII y lo clasifica", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300PII01",
                plataformaId: plataforma!.id,
                texto: "Mi hija María del colegio San José recibió mensajes.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-PII001",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.9,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "REQUIERE_ANONIMIZACION",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta, confianza: 0.9, posibleAgresorPar: false }],
        });
        mockPii.mockResolvedValueOnce({
            contienePii: true,
            contienePiiDeterministico: true,
            contienePiiLLM: true,
            piiDetectada: ["María", "colegio San José"],
            piiDetectadaDeterministica: ["María", "colegio San José"],
            piiDetectadaLLM: ["María", "colegio San José"],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        mockAnonimizar.mockResolvedValue({
            textoAnonimizado: "Mi hija [NOMBRE] del [COLEGIO] recibió mensajes.",
            piiDetectada: ["María", "colegio San José"],
            metrics: { modelo: "ornith:9b", latenciaMs: 800 },
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("CLASIFICADO");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
        expect(actualizado?.textoOriginal).toBe("Mi hija María del colegio San José recibió mensajes.");
        expect(actualizado?.texto).toBe("Mi hija [NOMBRE] del [COLEGIO] recibió mensajes.");
    });

    it("no muta estado en errores transitorios de anonimización (reintentable)", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300PIIERR",
                plataformaId: plataforma!.id,
                texto: "Mi hija María recibió mensajes.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-PIIERR",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.9,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "REQUIERE_ANONIMIZACION",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta, confianza: 0.9, posibleAgresorPar: false }],
        });
        mockPii.mockResolvedValueOnce({
            contienePii: true,
            contienePiiDeterministico: true,
            contienePiiLLM: false,
            piiDetectada: ["María"],
            piiDetectadaDeterministica: ["María"],
            piiDetectadaLLM: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        mockAnonimizar.mockRejectedValue(new Error("Ollama no disponible"));
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.retryable).toBe(true);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("PROCESANDO");
        expect(actualizado?.processingError).toBeNull();
    });

    it("marca reporte anónimo duplicado cuando supera el umbral de similitud", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const origen = await prisma.reporte.create({
            data: {
                identificador: "+57300DUP001",
                plataformaId: plataforma!.id,
                texto: "Este número contactó a mi hija ofreciendo regalos.",
                fechaIncidente: new Date("2026-07-10T14:30:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-DUP-01",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.92,
            posibleAgresorPar: false,
            contienePii: false,
            piiDetectada: [],
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1200, promptTokens: 100, responseTokens: 20 },
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        // Procesar origen para generar embedding y estado CLASIFICADO
        const resOrigen = await POST(crearRequestProcesar(origen.id));
        expect(resOrigen.status).toBe(200);

        const duplicado = await prisma.reporte.create({
            data: {
                identificador: "+57300DUP001",
                plataformaId: plataforma!.id,
                texto: "Este número contactó a mi hija ofreciendo regalos otra vez.",
                fechaIncidente: new Date("2026-07-10T15:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-DUP-02",
                estado: "PENDIENTE",
            },
        });

        const resDuplicado = await POST(crearRequestProcesar(duplicado.id));
        expect(resDuplicado.status).toBe(200);
        const bodyDuplicado = await resDuplicado.json();
        expect(bodyDuplicado.estado).toBe("DUPLICADO");

        const actualizado = await prisma.reporte.findUnique({ where: { id: duplicado.id } });
        expect(actualizado?.estado).toBe("DUPLICADO");
        expect(actualizado?.reporteOrigenId).toBe(origen.id);
    });

    it("no reprocesa reporte ya en estado final", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300FINAL",
                plataformaId: plataforma!.id,
                texto: "Texto de reporte ya finalizado.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-FINAL1",
                estado: "CLASIFICADO",
            },
        });

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(200);
        expect(mockClasificar).not.toHaveBeenCalled();
    });

    it("no muta estado en errores transitorios del embedding (reintentable)", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300ERR01",
                plataformaId: plataforma!.id,
                texto: "Texto que causará error en embedding.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-ERR001",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            confianza: 0.8,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "CONTACTO_INSISTENTE" as CategoriaConducta, confianza: 0.8, posibleAgresorPar: false }],
        });
        mockEmbedding.mockRejectedValue(new Error("Ollama no disponible"));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(500);
        const body = await res.json();
        expect(body.error.retryable).toBe(true);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("PROCESANDO");
        expect(actualizado?.processingError).toBeNull();
    });

    it("envía alerta de revisión cuando el procesamiento falla con error no transitorio", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300ALERT",
                plataformaId: plataforma!.id,
                texto: "Texto.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-ALERT",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.9,
            posibleAgresorPar: false,
            contienePii: true,
            piiDetectada: ["María"],
            estado: "REQUIERE_ANONIMIZACION",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
        });
        mockPii.mockResolvedValueOnce({
            contienePii: true,
            contienePiiDeterministico: true,
            contienePiiLLM: false,
            piiDetectada: ["María"],
            piiDetectadaDeterministica: ["María"],
            piiDetectadaLLM: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        const noTransitorio = Object.assign(new Error("Fallo determinístico del pipeline"), { retryable: false });
        mockAnonimizar.mockRejectedValue(noTransitorio);
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        await POST(crearRequestProcesar(reporte.id));

        await vi.waitFor(() =>
            expect(mockEnviarAlertaRevision).toHaveBeenCalledWith(
                expect.objectContaining({
                    numeroSeguimiento: "RPT-ALERT",
                    identificador: "+57300ALERT",
                    estado: "REVISION_MANUAL",
                })
            )
        );
    });

    it("envía alerta de score crítico cuando el identificador alcanza riesgo crítico", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        mockClasificar.mockResolvedValue({
            categoria: "COMPARTIMIENTO_SEXUAL" as CategoriaConducta,
            confianza: 0.95,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "COMPARTIMIENTO_SEXUAL" as CategoriaConducta, confianza: 0.95, posibleAgresorPar: false }],
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const reportes = [];
        for (let i = 0; i < 8; i++) {
            // Espaciar creadoEn para evitar que la guarda de ráfagas dispare
            // (N=3 en 24h). 25h entre cada reporte evita la ventana.
            const creadoEn = new Date(Date.now() - (8 - i) * 25 * 60 * 60 * 1000);
            const reporte = await prisma.reporte.create({
                data: {
                    identificador: "+57300CRITICO",
                    plataformaId: plataforma!.id,
                    texto: `Reporte ${i + 1} de solicitud de material íntimo.`,
                    fechaIncidente: new Date(`2026-07-${10 + i}T10:00:00Z`),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: false,
                    numeroSeguimiento: `RPT-CRIT-${String(i + 1).padStart(2, "0")}`,
                    estado: "PENDIENTE",
                    creadoEn,
                },
            });
            reportes.push(reporte);
        }

        for (let i = 0; i < reportes.length; i++) {
            const res = await POST(crearRequestProcesar(reportes[i].id));
            expect(res.status).toBe(200);
        }

        await vi.waitFor(() =>
            expect(mockEnviarAlertaScoreCritico).toHaveBeenCalledWith(
                expect.objectContaining({
                    identificador: "+57300CRITICO",
                    nivelRiesgo: "CRITICO",
                })
            )
        );
    });

    it("persiste posibleAgresorPar", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300MULTI",
                plataformaId: plataforma!.id,
                texto: "Me ofreció regalos y me pidió quedar a solas.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-MULTI",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta,
            confianza: 0.85,
            categoriasSecundarias: [],
            posibleAgresorPar: true,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "OFRECIMIENTO_REGALOS" as CategoriaConducta, confianza: 0.85, posibleAgresorPar: true }],
        });
        mockPii.mockResolvedValueOnce({
            contienePii: false,
            contienePiiDeterministico: false,
            contienePiiLLM: false,
            piiDetectada: [],
            piiDetectadaDeterministica: [],
            piiDetectadaLLM: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(200);

        const clasif = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(clasif?.posibleAgresorPar).toBe(true);
    });

    it("escala a revisión manual cuando detectarDoxing dispara y el LLM no incluye DOXING", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300DOX",
                plataformaId: plataforma!.id,
                texto: "Publicó mi dirección cra 7 # 45-67 y mi celular 3001234567 para que otros me acosen",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-DOX",
                estado: "PENDIENTE",
            },
        });

        mockClasificar.mockResolvedValue({
            categoria: "OTRO" as CategoriaConducta,
            confianza: 0.6,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "OTRO" as CategoriaConducta, confianza: 0.6, posibleAgresorPar: false }],
        });
        mockPii.mockResolvedValueOnce({
            contienePii: true,
            contienePiiDeterministico: true,
            contienePiiLLM: false,
            piiDetectada: ["mi dirección", "mi número"],
            piiDetectadaDeterministica: ["mi dirección", "mi número"],
            piiDetectadaLLM: [],
            metrics: { modelo: "ornith:9b", latenciaMs: 0, promptTokens: null, responseTokens: null },
            rawResponse: "{}",
        });
        mockAnonimizar.mockResolvedValueOnce({
            textoAnonimizado: "Publicó [DIRECCION] exacta y [TELEFONO] para que otros me acosen",
            piiDetectada: ["mi dirección", "mi número"],
            metrics: { modelo: "ornith:9b", latenciaMs: 800 },
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("REVISION_MANUAL");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");
        expect(actualizado?.prioridadAlta).toBe(true);
        expect(actualizado?.keywordsDetectadas.length).toBeGreaterThan(0);

        const clasif = await prisma.clasificacionIA.findUnique({ where: { reporteId: reporte.id } });
        expect(clasif?.categoria).toBe("OTRO");
    });

    it("detecta ráfaga de reportes y fuerza revisión manual con prioridad alta", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        mockClasificar.mockResolvedValue({
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            confianza: 1.0,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "CONTACTO_INSISTENTE" as CategoriaConducta, confianza: 1.0, posibleAgresorPar: false }],
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const identificador = "+57300RAFAGA";
        const reportes = [];
        for (let i = 0; i < 3; i++) {
            const reporte = await prisma.reporte.create({
                data: {
                    identificador,
                    plataformaId: plataforma!.id,
                    texto: `Reporte de ráfaga ${i + 1}`,
                    fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                    ciudad: "Bogotá",
                    pais: "Colombia",
                    esAnonimo: false,
                    numeroSeguimiento: `RPT-RAF-${String(i + 1).padStart(2, "0")}`,
                    estado: "PENDIENTE",
                },
            });
            reportes.push(reporte);
        }

        for (const reporte of reportes) {
            const res = await POST(crearRequestProcesar(reporte.id));
            expect(res.status).toBe(200);
        }

        for (const reporte of reportes) {
            const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
            expect(actualizado?.estado).toBe("REVISION_MANUAL");
            expect(actualizado?.prioridadAlta).toBe(true);
            expect(actualizado?.esRafaga).toBe(true);
        }
    });

    it("no cuenta reportes dados de baja para la detección de ráfagas", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        mockClasificar.mockResolvedValue({
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            confianza: 1.0,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "CONTACTO_INSISTENTE" as CategoriaConducta, confianza: 1.0, posibleAgresorPar: false }],
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const identificador = "+57300RAFBAJA";
        await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                texto: "Reporte activo previo",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-RAFBAJA-01",
                estado: "CLASIFICADO",
            },
        });
        await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                texto: "Reporte dado de baja previo",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-RAFBAJA-02",
                estado: "CLASIFICADO",
                eliminado: true,
            },
        });

        const nuevo = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                texto: "Reporte nuevo",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                numeroSeguimiento: "RPT-RAFBAJA-03",
                estado: "PENDIENTE",
            },
        });

        const res = await POST(crearRequestProcesar(nuevo.id));
        expect(res.status).toBe(200);
        const actualizado = await prisma.reporte.findUnique({ where: { id: nuevo.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
        expect(actualizado?.esRafaga).toBe(false);
    });

    it("no dispara ráfaga si el identificador ya tiene historial previo", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        mockClasificar.mockResolvedValue({
            categoria: "CONTACTO_INSISTENTE" as CategoriaConducta,
            confianza: 1.0,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "CONTACTO_INSISTENTE" as CategoriaConducta, confianza: 1.0, posibleAgresorPar: false }],
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const identificador = "+57300HISTORICO";
        // Reporte previo fuera de la ventana de 24h
        await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                texto: "Reporte histórico",
                fechaIncidente: new Date("2026-07-01T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-HIST-01",
                estado: "CLASIFICADO",
                creadoEn: new Date(Date.now() - 48 * 60 * 60 * 1000),
            },
        });

        const nuevo = await prisma.reporte.create({
            data: {
                identificador,
                plataformaId: plataforma!.id,
                texto: "Reporte nuevo",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-HIST-02",
                estado: "PENDIENTE",
            },
        });

        const res = await POST(crearRequestProcesar(nuevo.id));
        expect(res.status).toBe(200);
        const actualizado = await prisma.reporte.findUnique({ where: { id: nuevo.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
        expect(actualizado?.esRafaga).toBe(false);
    });

    it("escala a REVISION_MANUAL por keywords críticas en categoría OTRO", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        mockClasificar.mockResolvedValue({
            categoria: "OTRO" as CategoriaConducta,
            confianza: 1.0,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
            fallback: false,
            votos: [{ categoria: "OTRO" as CategoriaConducta, confianza: 1.0, posibleAgresorPar: false }],
        });
        mockEmbedding.mockResolvedValue(new Array(768).fill(0.1));

        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300KEYWORDS",
                plataformaId: plataforma!.id,
                texto: "grupo whatsapp pasa MASNNA menores",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-KW",
                estado: "PENDIENTE",
            },
        });

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("REVISION_MANUAL");
        expect(body.clasificacion.categoria).toBe("OTRO");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");
        expect(actualizado?.prioridadAlta).toBe(true);
        expect(actualizado?.keywordsDetectadas).toContain("masnna");
    });
});
