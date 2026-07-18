import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearParametrosReportes, crearPlataforma, crearPaisCiudad, crearUsuario } from "@/lib/reporte-test-utils";
import { registrarTransicion } from "@/lib/reporte-transiciones";

function crearRequestFallback(reporteId: string, error: string, secret?: string) {
    return new Request("http://localhost:5005/api/reportes/fallback", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-worker-secret": secret ?? (process.env.WORKER_SECRET || "worker-secret-test") },
        body: JSON.stringify({ reporteId, error }),
    });
}

describe("POST /api/reportes/fallback", () => {
    beforeEach(async () => {
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        process.env.WORKER_SECRET = "worker-secret-test";
    });

    it("rechaza request sin worker secret", async () => {
        const req = new Request("http://localhost:5005/api/reportes/fallback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ reporteId: "cmr-fake", error: "fallo" }),
        });
        const res = await POST(req);
        expect(res.status).toBe(403);
    });

    it("mueve reporte a REVISION_MANUAL y registra transición al agotar reintentos", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300FALLBACK",
                plataformaId: plataforma!.id,
                texto: "Texto de prueba suficientemente largo para no ser spam y describe un incidente con un menor.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-FALLBACK",
                estado: "PROCESANDO",
            },
        });

        const res = await POST(crearRequestFallback(reporte.id, "Ollama no disponible tras 3 reintentos"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("REVISION_MANUAL");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");
        expect(actualizado?.processingError).toContain("Ollama no disponible");

        const transiciones = await prisma.transicionReporte.findMany({
            where: { reporteId: reporte.id },
            orderBy: { creadoEn: "asc" },
        });
        expect(transiciones).toHaveLength(1);
        expect(transiciones[0].estadoAnterior).toBe("PROCESANDO");
        expect(transiciones[0].estadoNuevo).toBe("REVISION_MANUAL");
        expect(transiciones[0].responsableTipo).toBe("WORKER");
    });

    it("es idempotente si el reporte ya está en REVISION_MANUAL", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300FALLBACK2",
                plataformaId: plataforma!.id,
                texto: "Texto de prueba suficientemente largo para no ser spam y describe un incidente con un menor.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-FALLBACK2",
                estado: "REVISION_MANUAL",
                processingError: "Error previo",
            },
        });

        const res = await POST(crearRequestFallback(reporte.id, "Nuevo error"));
        expect(res.status).toBe(200);

        const transiciones = await prisma.transicionReporte.count({ where: { reporteId: reporte.id } });
        expect(transiciones).toBe(0);
    });

    it("registra transición desde PENDIENTE si nunca se inició procesamiento", async () => {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300FALLBACK3",
                plataformaId: plataforma!.id,
                texto: "Texto de prueba suficientemente largo para no ser spam y describe un incidente con un menor.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-FALLBACK3",
                estado: "PENDIENTE",
            },
        });

        const res = await POST(crearRequestFallback(reporte.id, "Fallo de encolamiento"));
        expect(res.status).toBe(200);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REVISION_MANUAL");

        const transiciones = await prisma.transicionReporte.findMany({
            where: { reporteId: reporte.id },
        });
        expect(transiciones).toHaveLength(1);
        expect(transiciones[0].estadoAnterior).toBe("PENDIENTE");
        expect(transiciones[0].estadoNuevo).toBe("REVISION_MANUAL");
    });
});
