/**
 * SPEC-221 (002-PI-122): tests de integración del endpoint
 * POST /api/admin/analisis/recomendaciones/[id]/resolver — matriz de códigos
 * 200/400/401/403/404/409 según contracts/resolver-recomendacion.md.
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

const URL_BASE = "http://localhost:5005/api/admin/analisis/recomendaciones";

async function crearRecomendacionPendiente(adminId: string) {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.route"),
            nombre: "Regla",
            descripcion: "Regla",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
        },
    });
    return prisma.recomendacion.create({
        data: {
            reglaId: regla.id,
            titulo: "Llamar al colegio",
            descripcion: "Descripción",
            categoria: "renovacion",
            prioridad: 90,
            datosContexto: { dedupKey: unico("k") },
            expiraEn: new Date(Date.now() + 86_400_000),
        },
    });
}

function llamar(id: string, body: unknown) {
    const req = crearRequestAutenticado("POST", `${URL_BASE}/${id}/resolver`, body, mockToken);
    return POST(req, { params: Promise.resolve({ id }) });
}

describe("POST /api/admin/analisis/recomendaciones/[id]/resolver", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: resuelve como APLICADA con motivo y registra AuditLog", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const rec = await crearRecomendacionPendiente(admin.id);

        const res = await llamar(rec.id, { estado: "APLICADA", motivo: "Gestión hecha" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.recomendacion.estado).toBe("APLICADA");
        expect(body.recomendacion.resueltaPorAdminId).toBe(admin.id);
        expect(body.recomendacion.motivoResolucion).toBe("Gestión hecha");
        expect(body.recomendacion.resueltaEn).not.toBeNull();

        expect(
            await prisma.auditLog.count({ where: { accion: "RECOMENDACION_RESUELTA", recursoId: rec.id } })
        ).toBe(1);
    });

    it("400: estado fuera de {APLICADA, IGNORADA}", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const rec = await crearRecomendacionPendiente(admin.id);

        for (const estado of ["EXPIRADA", "PENDIENTE", "BORRADA"]) {
            const res = await llamar(rec.id, { estado });
            expect(res.status).toBe(400);
        }
        const resMotivoLargo = await llamar(rec.id, { estado: "APLICADA", motivo: "x".repeat(501) });
        expect(resMotivoLargo.status).toBe(400);
    });

    it("401: sin sesión", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const rec = await crearRecomendacionPendiente(admin.id);
        mockToken = undefined;

        const res = await llamar(rec.id, { estado: "APLICADA" });
        expect(res.status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const rec = await crearRecomendacionPendiente(admin.id);

        const res = await llamar(rec.id, { estado: "APLICADA" });
        expect(res.status).toBe(403);
    });

    it("404: id inexistente", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar("cl_inexistente_000000000000", { estado: "APLICADA" });
        expect(res.status).toBe(404);
    });

    it("409: ya resuelta (el estado no cambia)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const rec = await crearRecomendacionPendiente(admin.id);

        const primera = await llamar(rec.id, { estado: "APLICADA" });
        expect(primera.status).toBe(200);

        const segunda = await llamar(rec.id, { estado: "IGNORADA" });
        expect(segunda.status).toBe(409);

        const recargada = await prisma.recomendacion.findUnique({ where: { id: rec.id } });
        expect(recargada?.estado).toBe("APLICADA");
    });

    // SPEC-222 (002-PI-123, FR-004): el contrato del panel Dinero vs Valor usa
    // `accion`; el endpoint la acepta como alias de `estado` (exactamente uno).
    it("200 con `accion` (alias SPEC-222); 400 si vienen ambos o ninguno", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const rec = await crearRecomendacionPendiente(admin.id);

        const res = await llamar(rec.id, { accion: "IGNORADA", motivo: "No aplica esta semana" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.recomendacion.estado).toBe("IGNORADA");

        const rec2 = await crearRecomendacionPendiente(admin.id);
        expect((await llamar(rec2.id, { estado: "APLICADA", accion: "IGNORADA" })).status).toBe(400);
        expect((await llamar(rec2.id, { motivo: "sin acción" })).status).toBe(400);

        const recargada = await prisma.recomendacion.findUnique({ where: { id: rec2.id } });
        expect(recargada?.estado).toBe("PENDIENTE");
    });
});
