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

async function crearReporteDePrueba({
    identificador = "+57300TEST000",
    numeroSeguimiento = `RPT-${Date.now()}`,
}: { identificador?: string; numeroSeguimiento?: string } = {}) {
    const plataforma = await prisma.plataforma.findUnique({ where: { clave: "whatsapp" } });
    const textoOriginal = "Texto de prueba para anonimización.";
    const textoAnonimizado = "Texto de prueba para anonimización.";
    return prisma.reporte.create({
        data: {
            identificador,
            plataformaId: plataforma!.id,
            texto: textoAnonimizado,
            textoOriginal: encryptParameter(textoOriginal),
            fechaIncidente: new Date("2026-07-10T10:00:00Z"),
            ciudad: "Bogotá",
            pais: "Colombia",
            esAnonimo: false,
            estado: "REVISION_MANUAL",
            numeroSeguimiento,
        },
    });
}

describe("GET /api/admin/reportes-revision", () => {
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

    it("filtra por número de seguimiento parcial", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const reporte = await crearReporteDePrueba({
            numeroSeguimiento: "RPT-SEARCH123",
            identificador: "+57300000000",
        });
        await crearReporteDePrueba({
            numeroSeguimiento: "RPT-OTHER456",
            identificador: "+57300000001",
        });

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision?q=${encodeURIComponent("SEARCH")}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].id).toBe(reporte.id);
    });

    it("filtra por identificador parcial", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const reporte = await crearReporteDePrueba({
            numeroSeguimiento: "RPT-OTHER789",
            identificador: "reportado.nick.abc",
        });
        await crearReporteDePrueba({
            numeroSeguimiento: "RPT-OTHER790",
            identificador: "otro.nick.xyz",
        });

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision?q=${encodeURIComponent("reportado.nick")}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].id).toBe(reporte.id);
    });

    it("rechaza búsquedas con menos de 3 caracteres", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision?q=ab`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(400);
    });
});
