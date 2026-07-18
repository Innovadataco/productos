import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
    crearRequestAutenticado,
    crearPlataforma,
    crearPaisCiudad,
} from "@/lib/reporte-test-utils";
import { encryptParameter } from "@/lib/param-encryption";

let activeToken: string | null = null;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && activeToken ? { name: "token", value: activeToken } : undefined,
        set: vi.fn(),
    }),
}));

async function crearReporteParaValidar(operadorId?: string) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Mi hija María estudia en el colegio San José.";
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: "Mi hija [NOMBRE] estudia en [COLEGIO].",
            textoOriginal: encryptParameter(textoOriginal),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REQUIERE_ANONIMIZACION",
            numeroSeguimiento: `RPT-${Date.now()}`,
            operadorId,
        },
    });
}

describe("POST /api/admin/reportes/[id]/validar-anonimizacion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        await crearPlataforma();
        await crearPaisCiudad();
        activeToken = null;
        if (!process.env.PARAM_ENCRYPTION_KEY) {
            process.env.PARAM_ENCRYPTION_KEY = "a".repeat(32);
        }
    });

    it("operador valida anonimización y pasa el caso a CLASIFICADO", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteParaValidar(operador.id);
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/validar-anonimizacion`,
            { valida: true },
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estadoNuevo).toBe("CLASIFICADO");

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
        expect(actualizado?.anonimizacionValidadaPorId).toBe(operador.id);
        expect(actualizado?.anonimizacionValidadaEn).not.toBeNull();

        const transicion = await prisma.transicionReporte.findFirst({
            where: { reporteId: reporte.id, estadoNuevo: "CLASIFICADO", responsableTipo: "OPERADOR" },
        });
        expect(transicion).not.toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ANONIMIZACION_VALIDADA", recursoId: reporte.id, usuarioId: operador.id },
        });
        expect(audit).not.toBeNull();
    });

    it("operador rechaza anonimización y mantiene el estado en REQUIERE_ANONIMIZACION", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteParaValidar(operador.id);
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/validar-anonimizacion`,
            { valida: false, observaciones: "Aún queda el nombre del colegio" },
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.estado).toBe("REQUIERE_ANONIMIZACION");
        expect(body.validado).toBe(false);

        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("REQUIERE_ANONIMIZACION");
        expect(actualizado?.anonimizacionValidadaPorId).toBeNull();

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "ANONIMIZACION_RECHAZADA", recursoId: reporte.id, usuarioId: operador.id },
        });
        expect(audit).not.toBeNull();
    });

    it("admin puede validar sin estar asignado", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteParaValidar();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/validar-anonimizacion`,
            { valida: true },
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const actualizado = await prisma.reporte.findUnique({ where: { id: reporte.id } });
        expect(actualizado?.estado).toBe("CLASIFICADO");
    });

    it("bloquea a usuarios PARENT", async () => {
        const parent = await crearUsuario("PARENT");
        const reporte = await crearReporteParaValidar();
        activeToken = await crearTokenUsuario(parent.id, "PARENT");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/validar-anonimizacion`,
            { valida: true },
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });
});
