/**
 * SPEC-224 (002-PI-125, FR-009, SC-004): tests de integración de
 * POST /api/admin/analisis/reglas/[id]/modo — promoción con confirmación
 * fuerte (escribir EJECUTA) + motivo ≥ 20, reversión con motivo, 409 si ya
 * está en el modo, y AuditLog con valorAnterior/valorNuevo + motivo.
 * NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
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

const URL_BASE = "http://localhost:5005/api/admin/analisis/reglas";

async function crearReglaDirecta(adminId: string, overrides: Record<string, unknown> = {}) {
    return prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.modo"),
            nombre: "Regla de prueba",
            descripcion: "Descripción",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Plantilla",
            creadaPorAdminId: adminId,
            ...overrides,
        },
    });
}

function llamar(id: string, body: unknown) {
    return POST(crearRequestAutenticado("POST", `${URL_BASE}/${id}/modo`, body, mockToken), {
        params: Promise.resolve({ id }),
    });
}

describe("POST /api/admin/analisis/reglas/[id]/modo", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    async function adminConRegla(overrides: Record<string, unknown> = {}) {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await crearReglaDirecta(admin.id, overrides);
        return { admin, regla };
    }

    it("200: promoción con confirmación y motivo audita REGLA_PROMOVIDA_EJECUTA", async () => {
        const { admin, regla } = await adminConRegla({ accionEjecutable: "crear_bono_retencion" });

        const res = await llamar(regla.id, {
            modo: "EJECUTA",
            confirmacion: "EJECUTA",
            motivo: "la regla lleva 3 semanas con 90% de aplicación manual",
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toMatchObject({ id: regla.id, modo: "EJECUTA", advertencia: null });

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REGLA_PROMOVIDA_EJECUTA", recursoId: regla.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorAnterior).toBe("RECOMIENDA");
        expect(audit?.valorNuevo).toBe("EJECUTA");
        expect((audit?.metadatos as Record<string, unknown>).motivo).toContain("3 semanas");
    });

    it("400: promoción sin confirmación exacta no cambia el modo (SC-004)", async () => {
        const { regla } = await adminConRegla();

        for (const body of [
            { modo: "EJECUTA", motivo: "motivo de más de veinte caracteres" },
            { modo: "EJECUTA", confirmacion: "ejecuta", motivo: "motivo de más de veinte caracteres" },
            { modo: "EJECUTA", confirmacion: "EJECUTA", motivo: "corto" },
            { modo: "EJECUTA", confirmacion: "EJECUTA", motivo: "          " },
        ]) {
            const res = await llamar(regla.id, body);
            expect(res.status).toBe(400);
        }
        const actual = await prisma.reglaRecomendacion.findUnique({ where: { id: regla.id } });
        expect(actual?.modo).toBe("RECOMIENDA");
        const audits = await prisma.auditLog.count({ where: { accion: "REGLA_PROMOVIDA_EJECUTA" } });
        expect(audits).toBe(0);
    });

    it("409: la regla ya está en el modo solicitado", async () => {
        const { regla } = await adminConRegla();
        const res = await llamar(regla.id, { modo: "RECOMIENDA", motivo: "ya está en recomienda de fábrica" });
        expect(res.status).toBe(409);
    });

    it("200: reversión a RECOMIENDA con motivo audita REGLA_REVERTIDA_RECOMIENDA", async () => {
        const { admin, regla } = await adminConRegla({ modo: "EJECUTA", accionEjecutable: "enviar_notificacion" });

        const res = await llamar(regla.id, {
            modo: "RECOMIENDA",
            motivo: "generó dos bonos duplicados, vuelve a revisión humana",
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.modo).toBe("RECOMIENDA");

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REGLA_REVERTIDA_RECOMIENDA", recursoId: regla.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        expect(audit?.valorAnterior).toBe("EJECUTA");
        expect(audit?.valorNuevo).toBe("RECOMIENDA");
    });

    it("200: EJECUTA sin accionEjecutable devuelve advertencia (se comporta como Recomienda)", async () => {
        const { regla } = await adminConRegla();
        const res = await llamar(regla.id, {
            modo: "EJECUTA",
            confirmacion: "EJECUTA",
            motivo: "promuevo para probar la advertencia del panel",
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.advertencia).toContain("Sin acción ejecutable configurada");
    });

    it("200: regla inactiva devuelve advertencia de inactividad", async () => {
        const { regla } = await adminConRegla({ activa: false, accionEjecutable: "crear_alerta_admin" });
        const res = await llamar(regla.id, {
            modo: "EJECUTA",
            confirmacion: "EJECUTA",
            motivo: "promuevo una regla inactiva para el edge case",
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.advertencia).toContain("La regla está inactiva");
    });

    it("401: sin sesión / 403: rol distinto de ADMIN", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const regla = await crearReglaDirecta(admin.id);

        mockToken = undefined;
        expect((await llamar(regla.id, { modo: "RECOMIENDA", motivo: "motivo de más de veinte caracteres" })).status).toBe(401);

        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        expect((await llamar(regla.id, { modo: "RECOMIENDA", motivo: "motivo de más de veinte caracteres" })).status).toBe(403);
    });
});
