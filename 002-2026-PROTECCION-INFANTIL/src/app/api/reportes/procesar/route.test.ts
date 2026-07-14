import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad } from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

const mockClasificar = vi.fn();
const mockEmbedding = vi.fn();
const mockAnonimizar = vi.fn();

vi.mock("@/lib/ai/classifier", () => ({
    clasificarReporte: (...args: unknown[]) => mockClasificar(...args),
}));

vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: (...args: unknown[]) => mockEmbedding(...args),
}));

vi.mock("@/lib/ai/anonimizador", () => ({
    anonimizarTexto: (...args: unknown[]) => mockAnonimizar(...args),
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
        mockEmbedding.mockReset();
        mockAnonimizar.mockReset();
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
            contienePii: false,
            piiDetectada: [],
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1200, promptTokens: 100, responseTokens: 20 },
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
            contienePii: true,
            piiDetectada: ["María", "colegio San José"],
            estado: "REQUIERE_ANONIMIZACION",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
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

    it("guarda processingError cuando la anonimización falla", async () => {
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
            contienePii: true,
            piiDetectada: ["María"],
            estado: "REQUIERE_ANONIMIZACION",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
        });
        mockAnonimizar.mockRejectedValue(new Error("Ollama no disponible"));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(500);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");
        expect(actualizado?.processingError).toContain("Ollama no disponible");
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

    it("guarda processingError cuando el embedding falla", async () => {
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
            contienePii: false,
            piiDetectada: [],
            estado: "CLASIFICADO",
            rawResponse: "{}",
            metrics: { modelo: "ornith:9b", latenciaMs: 1000 },
        });
        mockEmbedding.mockRejectedValue(new Error("Ollama no disponible"));

        const res = await POST(crearRequestProcesar(reporte.id));
        expect(res.status).toBe(500);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");
        expect(actualizado?.processingError).toContain("Ollama no disponible");
    });
});
