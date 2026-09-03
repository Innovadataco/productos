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

    // ── SPEC-384 · I-278 · la lista también la usa el comité ────────────────
    // route.ts:89-90: `where.comiteId = user.id`. Antes el guardia exigía
    // `bandeja_reportes` (del operador, I-274 lo separó del comité), así que
    // el comité veía 403 y su bandeja unificada quedaba parcial.
    async function desactivarBandejaReportesParaComite() {
        const modulo = await prisma.moduloPermisible.findUnique({ where: { clave: "bandeja_reportes" } });
        expect(modulo, "el módulo debería estar sembrado").not.toBeNull();
        await prisma.permisoModulo.upsert({
            where: { rol_moduloId: { rol: "COMITE_VALIDACION", moduloId: modulo!.id } },
            update: { activo: false },
            create: { rol: "COMITE_VALIDACION", moduloId: modulo!.id, activo: false },
        });
    }

    it("SPEC-384/I-278: comité con comite_bandeja lista SUS casos aunque bandeja_reportes esté DESACTIVADO", async () => {
        await desactivarBandejaReportesParaComite();
        const comite = await crearUsuario("COMITE_VALIDACION");
        const propio = await crearReporteDePrueba({ numeroSeguimiento: "RPT-COMIT001", identificador: "+57300COMI01" });
        const ajeno = await crearReporteDePrueba({ numeroSeguimiento: "RPT-COMIT002", identificador: "+57300COMI02" });
        await prisma.reporte.update({ where: { id: propio.id }, data: { comiteId: comite.id } });
        // `ajeno` queda sin comite → no debe aparecer.
        activeToken = await crearTokenUsuario(comite.id, "COMITE_VALIDACION");

        const req = new Request(
            "http://localhost:5005/api/admin/reportes-revision?pageSize=25",
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        const ids = (body.reporte ?? body.reportes ?? []).map((r: { id: string }) => r.id);
        expect(ids, "solo el caso asignado a este comité aparece").toEqual([propio.id]);
        // Aseguramos que el otro reporte SÍ existe en la BD (el filtro sí lo excluye).
        expect(await prisma.reporte.findUnique({ where: { id: ajeno.id } })).not.toBeNull();
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

    // SPEC-188 (FR-002/003): filtro por operador y DTO con email del operador.
    it("filtra por operadorId y expone el email del operador en la fila", async () => {
        const admin = await crearUsuario("ADMIN");
        const operador = await crearUsuario("OPERADOR", "operador188@example.com");
        activeToken = await crearTokenUsuario(admin.id, "ADMIN");

        const asignado = await crearReporteDePrueba({ numeroSeguimiento: "RPT-OPR-001" });
        const sinAsignar = await crearReporteDePrueba({ numeroSeguimiento: "RPT-OPR-002" });

        await prisma.reporte.update({ where: { id: asignado.id }, data: { operadorId: operador.id } });

        const req = new Request(
            `http://localhost:5005/api/admin/reportes-revision?operadorId=${operador.id}`,
            { method: "GET", headers: { cookie: `token=${activeToken}` } }
        );
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.reportes).toHaveLength(1);
        expect(body.reportes[0].id).toBe(asignado.id);
        expect(body.reportes[0].operador?.email).toBe("operador188@example.com");
        expect(body.reportes.find((r: { id: string }) => r.id === sinAsignar.id)).toBeUndefined();
    });
});
