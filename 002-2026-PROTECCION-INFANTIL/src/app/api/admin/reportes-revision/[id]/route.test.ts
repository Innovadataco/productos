import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import {
    crearUsuario,
    crearTokenUsuario,
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

async function crearReporteDePrueba({ operadorId }: { operadorId?: string } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Mi hija María estudia en el colegio San José y su teléfono es 3001234567.";
    const textoAnonimizado = "Mi hija [NOMBRE] estudia en [COLEGIO] y su teléfono es [TELEFONO].";
    return prisma.reporte.create({
        data: {
            identificador: "+57300TEST000",
            plataformaId: plataforma!.id,
            texto: textoAnonimizado,
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

describe("GET /api/admin/reportes-revision/[id]", () => {
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

    it("no expone textoOriginal ni datos del denunciante al operador", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteDePrueba({ operadorId: operador.id });
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reporte).toBeDefined();
        expect(body.reporte.textoOriginal).toBeUndefined();
        expect(body.reporte.usuarioId).toBeUndefined();
        expect(body.reporte.usuario).toBeUndefined();
        expect(body.puedeRevelarOriginal).toBe(false);
    });

    it("indica al admin que puede revelar el original", async () => {
        const admin = await crearUsuario("ADMIN");
        const reporte = await crearReporteDePrueba();
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reporte.textoOriginal).toBeUndefined();
        expect(body.puedeRevelarOriginal).toBe(true);
    });

    it("bloquea a operador no asignado", async () => {
        const operador = await crearUsuario("OPERADOR");
        const reporte = await crearReporteDePrueba();
        activeToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision/${reporte.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req, { params: Promise.resolve({ id: reporte.id }) });
        expect(res.status).toBe(403);
    });
});
