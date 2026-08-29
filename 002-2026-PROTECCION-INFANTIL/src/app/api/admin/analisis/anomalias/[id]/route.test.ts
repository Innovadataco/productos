/**
 * SPEC-225 (FR-013/FR-014, FR-016): tests de integración de
 * GET|PATCH /api/admin/analisis/anomalias/[id] — matriz 200/400/401/403/404/409
 * y AuditLog de la resolución (ANOMALIA_RESUELTA, sin PII).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, PATCH } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

const URL_BASE = "http://localhost:5005/api/admin/analisis/anomalias";

async function crearAnomalia(overrides: Record<string, unknown> = {}) {
    return prisma.anomalia.create({
        data: {
            tipo: "CANCELACION_COLEGIO_GRANDE",
            sujetoTipo: "Colegio",
            sujetoId: unico("colegio"),
            severidad: "ALTA",
            descripcion: "Un colegio con 51 reportes históricos canceló su suscripción.",
            datosContexto: { reportesHistoricos: 51, umbralMinReportes: 50 },
            ...overrides,
        },
    });
}

function llamarGet(id: string) {
    const req = crearRequestAutenticado("GET", `${URL_BASE}/${id}`, undefined, mockToken);
    return GET(req, { params: Promise.resolve({ id }) });
}

function llamarPatch(id: string, body: unknown) {
    const req = crearRequestAutenticado("PATCH", `${URL_BASE}/${id}`, body, mockToken);
    return PATCH(req, { params: Promise.resolve({ id }) });
}

describe("GET /api/admin/analisis/anomalias/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: devuelve el detalle incluyendo datosContexto", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const anomalia = await crearAnomalia();

        const res = await llamarGet(anomalia.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.id).toBe(anomalia.id);
        expect(body.datosContexto).toMatchObject({ reportesHistoricos: 51 });
    });

    it("404: id inexistente", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await llamarGet("cl_inexistente_000000000000");
        expect(res.status).toBe(404);
    });

    it("401/403: sin sesión y rol distinto de ADMIN", async () => {
        const anomalia = await crearAnomalia();

        mockToken = undefined;
        expect((await llamarGet(anomalia.id)).status).toBe(401);

        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        expect((await llamarGet(anomalia.id)).status).toBe(403);
    });
});

describe("PATCH /api/admin/analisis/anomalias/[id]", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: marca resueltaEn/resueltaPorAdminId, conserva la nota y registra AuditLog", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const anomalia = await crearAnomalia();

        const res = await llamarPatch(anomalia.id, { notaResolucion: "Contactado el colegio" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.resueltaEn).not.toBeNull();
        expect(body.resueltaPorAdminId).toBe(admin.id);

        const recargada = await prisma.anomalia.findUnique({ where: { id: anomalia.id } });
        expect(recargada?.datosContexto).toMatchObject({
            reportesHistoricos: 51,
            notaResolucion: "Contactado el colegio",
        });

        const audits = await prisma.auditLog.findMany({
            where: { accion: "ANOMALIA_RESUELTA", recursoId: anomalia.id },
        });
        expect(audits).toHaveLength(1);
        expect(audits[0]!.usuarioId).toBe(admin.id);
    });

    it("200: body vacío {} también resuelve (nota opcional)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const anomalia = await crearAnomalia();

        const res = await llamarPatch(anomalia.id, {});
        expect(res.status).toBe(200);
        const recargada = await prisma.anomalia.findUnique({ where: { id: anomalia.id } });
        expect(recargada?.resueltaEn).not.toBeNull();
        expect(recargada?.datosContexto).not.toHaveProperty("notaResolucion");
    });

    it("400: notaResolucion de más de 500 caracteres", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const anomalia = await crearAnomalia();

        const res = await llamarPatch(anomalia.id, { notaResolucion: "x".repeat(501) });
        expect(res.status).toBe(400);
    });

    it("401: sin sesión", async () => {
        const anomalia = await crearAnomalia();
        mockToken = undefined;
        expect((await llamarPatch(anomalia.id, {})).status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const anomalia = await crearAnomalia();
        expect((await llamarPatch(anomalia.id, {})).status).toBe(403);
    });

    it("404: id inexistente", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await llamarPatch("cl_inexistente_000000000000", {})).status).toBe(404);
    });

    it("409: ya resuelta (los datos no cambian)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const anomalia = await crearAnomalia();

        const primera = await llamarPatch(anomalia.id, { notaResolucion: "Primera gestión" });
        expect(primera.status).toBe(200);

        const segunda = await llamarPatch(anomalia.id, { notaResolucion: "Segunda gestión" });
        expect(segunda.status).toBe(409);

        const recargada = await prisma.anomalia.findUnique({ where: { id: anomalia.id } });
        expect(recargada?.datosContexto).toMatchObject({ notaResolucion: "Primera gestión" });
    });
});
