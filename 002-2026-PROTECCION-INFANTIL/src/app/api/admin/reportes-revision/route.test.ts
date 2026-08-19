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
    creadoEn,
    prioridadAlta = false,
}: { identificador?: string; numeroSeguimiento?: string; creadoEn?: Date; prioridadAlta?: boolean } = {}) {
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
            prioridadAlta,
            ...(creadoEn ? { creadoEn } : {}),
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
            "http://localhost:5005/api/admin/reportes-revision?q=ab",
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    // SPEC-181: el orden de la bandeja se parametriza con un mapa cerrado en el repo.
    it("orden=recientes y orden=antiguos reordenan; el default es prioridad", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const antiguo = await crearReporteDePrueba({
            numeroSeguimiento: "RPT-ORD-ANT1",
            identificador: "+573004440001",
            creadoEn: new Date("2026-07-01T10:00:00Z"),
        });
        const reciente = await crearReporteDePrueba({
            numeroSeguimiento: "RPT-ORD-REC1",
            identificador: "+573004440002",
            creadoEn: new Date("2026-07-10T10:00:00Z"),
        });
        const prioritario = await crearReporteDePrueba({
            numeroSeguimiento: "RPT-ORD-PRI1",
            identificador: "+573004440003",
            creadoEn: new Date("2026-07-05T10:00:00Z"),
            prioridadAlta: true,
        });

        const idsDe = async (url: string) => {
            const res = await GET(new Request(url, { method: "GET", headers: { cookie: `token=${activeToken}` } }));
            expect(res.status).toBe(200);
            const body = await res.json();
            return body.reportes.map((r: { id: string }) => r.id);
        };

        expect(await idsDe("http://localhost:5005/api/admin/reportes-revision?orden=recientes")).toEqual([
            reciente.id,
            prioritario.id,
            antiguo.id,
        ]);
        expect(await idsDe("http://localhost:5005/api/admin/reportes-revision?orden=antiguos")).toEqual([
            antiguo.id,
            prioritario.id,
            reciente.id,
        ]);
        // Sin `orden`: prioridadAlta primero, luego fecha descendente.
        expect(await idsDe("http://localhost:5005/api/admin/reportes-revision")).toEqual([
            prioritario.id,
            reciente.id,
            antiguo.id,
        ]);
    });

    it("rechaza un orden fuera del mapa cerrado", async () => {
        const admin = await crearUsuario("ADMIN");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const req = new Request(
            "http://localhost:5005/api/admin/reportes-revision?orden=alfabetico",
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(400);
    });
});
