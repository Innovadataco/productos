import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import {
    crearUsuario,
    crearTokenUsuario,
    crearPlataforma,
    crearPaisCiudad,
    crearParametrosReportes,
} from "@/lib/reporte-test-utils";
import type { CategoriaConducta } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

vi.mock("@/lib/ai/embedder", () => ({
    generarEmbedding: vi.fn().mockResolvedValue(new Array(768).fill(0.1)),
}));

describe("POST /api/admin/spam/[id]/resolver", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetDatabase();
        await crearParametrosReportes();
        await crearPlataforma();
        await crearPaisCiudad();
        mockToken = undefined;
    });

    async function setupReporteSpam(operadorId?: string) {
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300SPAMRES",
                plataformaId: plataforma!.id,
                texto: "Compra relojes baratos viagra cripto dinero fácil 100% gratis",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-SPAM-RES",
                estado: "POSIBLE_SPAM",
                operadorId,
            },
        });
        await prisma.clasificacionIA.create({
            data: {
                reporteId: reporte.id,
                categoria: "SPAM" as CategoriaConducta,
                confianza: 0.92,
                contienePii: false,
                modeloUsado: "ornith:9b",
                latenciaMs: 1000,
            },
        });
        return reporte;
    }

    function crearRequestResolver(reporteId: string, body: unknown, token?: string) {
        return new Request(`http://localhost:5005/api/admin/spam/${reporteId}/resolver`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Cookie: token ? `token=${token}` : "" },
            body: JSON.stringify(body),
        });
    }

    it("operador marca spam como válido y pasa a CLASIFICADO", async () => {
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        const reporte = await setupReporteSpam(operador.id);
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestResolver(reporte.id, { esSpam: false, categoria: "OTRO" }, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.estado).toBe("CLASIFICADO");
        expect(body.categoria).toBe("OTRO");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
    });

    it("operador confirma spam, da de baja y registra dataset", async () => {
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        const reporte = await setupReporteSpam(operador.id);
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestResolver(reporte.id, { esSpam: true, motivo: "Contenido promocional" }, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.estado).toBe("DADO_DE_BAJA");
        expect(body.motivoBaja).toBe("RETIRO_LIMPIEZA");
        expect(body.datasetRegistrado).toBe(true);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.eliminado).toBe(true);
        expect(actualizado?.motivoBaja).toBe("RETIRO_LIMPIEZA");

        const dataset = await prisma.datasetEntrenamiento.findFirst({
            where: { texto: reporte.texto, clasificacionCorrecta: "SPAM" },
        });
        expect(dataset).not.toBeNull();
        expect(dataset?.fuente).toBe("spam_revisado");
    });

    it("rechaza si el operador no está asignado", async () => {
        const operador = await crearUsuario("OPERADOR", "op@test.com");
        const otro = await crearUsuario("OPERADOR", "otro@test.com");
        const reporte = await setupReporteSpam(otro.id);
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestResolver(reporte.id, { esSpam: false, categoria: "OTRO" }, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    it("rechaza si el reporte no está en revisión de spam", async () => {
        const admin = await crearUsuario("ADMIN");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300NORMAL",
                plataformaId: plataforma!.id,
                texto: "Texto normal",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: true,
                numeroSeguimiento: "RPT-NORMAL",
                estado: "CLASIFICADO",
            },
        });
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestResolver(reporte.id, { esSpam: true }, mockToken);
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(400);
    });
});
