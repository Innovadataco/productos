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

async function crearReporteConOriginalCifrado() {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Mi hija María estudia en el colegio San José y su teléfono es 3001234567.";
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: "Texto anonimizado de prueba para el reporte de validación.",
            textoOriginal: encryptParameter(textoOriginal),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REQUIERE_ANONIMIZACION",
            numeroSeguimiento: `RPT-${Date.now()}`,
        },
    });
}

describe("POST /api/admin/reportes/[id]/revelar-original", () => {
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

    it("permite a ADMIN revelar el texto original y deja audit log", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteConOriginalCifrado();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.textoOriginal).toContain("María");
        expect(body.textoOriginal).toContain("3001234567");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "TEXTO_ORIGINAL_REVELADO", recursoId: reporte.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
    });

    it("bloquea a OPERADOR", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteConOriginalCifrado();
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });

    it("devuelve 404 si el reporte no tiene texto original", async () => {
        const admin = await crearUsuario("ADMIN");
        const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
        const reporte = await prisma.reporte.create({
            data: {
                identificador: "+57300TEST000",
                plataformaId: plataforma!.id,
                texto: "Texto sin original.",
                fechaIncidente: new Date("2026-07-10T10:00:00Z"),
                ciudad: "Bogotá",
                pais: "Colombia",
                esAnonimo: false,
                estado: "PENDIENTE",
                numeroSeguimiento: `RPT-${Date.now()}`,
            },
        });
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = crearRequestAutenticado(
            "POST",
            `http://localhost:5005/api/admin/reportes/${reporte.id}/revelar-original`,
            {},
            activeToken
        );
        const res = await POST(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(404);
    });
});
