/**
 * SPEC-226 (002-PI-mega-cola, FR-010/FR-012/FR-016): tests de INTEGRACIÓN de
 * POST /api/admin/analisis/recomendaciones/[id]/aplicar — 200 (con acción y
 * sin acción), 401, 403, 404, 409. NOTA: integración (BD compartida) — los
 * corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado, crearColegioConAdmin } from "@/lib/reporte-test-utils";

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

function urlBase(id: string) {
    return `http://localhost:5005/api/admin/analisis/recomendaciones/${id}/aplicar`;
}

function llamar(id: string) {
    return POST(crearRequestAutenticado("POST", urlBase(id), undefined, mockToken), {
        params: Promise.resolve({ id }),
    });
}

async function crearReglaYRec(adminId: string, conAccion: boolean) {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.aplicar"),
            nombre: "Regla aplicar",
            descripcion: "Regla aplicar",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            modo: "RECOMIENDA",
            ...(conAccion
                ? {
                    accionEjecutable: "crear_bono",
                    accionParametros: { tipoBono: "DESCUENTO_PCT", valor: 10, vigenciaDias: 7 },
                }
                : {}),
            creadaPorAdminId: adminId,
        },
    });
    const rec = await prisma.recomendacion.create({
        data: {
            reglaId: regla.id,
            titulo: "Sugerencia de prueba",
            descripcion: "Descripción",
            categoria: "renovacion",
            prioridad: 80,
            datosContexto: { dedupKey: unico("k") },
            expiraEn: new Date(Date.now() + 7 * 86_400_000),
            ...(conAccion
                ? {
                    accionSugerida: "crear_bono",
                    accionParametros: { tipoBono: "DESCUENTO_PCT", valor: 10, vigenciaDias: 7 },
                }
                : {}),
        },
    });
    return { regla, rec };
}

async function crearSuscripcionActiva() {
    const { colegio } = await crearColegioConAdmin();
    const admin = await crearUsuario("ADMIN", unico("adminplan") + "@test.local");
    const plan = await prisma.plan.upsert({
        where: { tipoTitular_duracion_anio: { tipoTitular: "COLEGIO", duracion: "MES_1", anio: 2026 } },
        update: {},
        create: {
            nombre: unico("Plan"),
            tipoTitular: "COLEGIO",
            duracion: "MES_1",
            anio: 2026,
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        },
    });
    return prisma.suscripcion.create({
        data: {
            tipoTitular: "COLEGIO",
            colegioId: colegio.id,
            estado: "ACTIVA",
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 86_400_000),
            codigoReferidoPropio: unico("REF"),
        },
    });
}

describe("POST /api/admin/analisis/recomendaciones/[id]/aplicar (SPEC-226)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200 sin acción ejecutable: recomendación APLICADA y ejecucion null", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { rec } = await crearReglaYRec(admin.id, false);

        const res = await llamar(rec.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.recomendacion.estado).toBe("APLICADA");
        expect(body.recomendacion.ejecutadaAutomatica).toBe(false);
        expect(body.ejecucion).toBeNull();
    });

    it("200 con acción crear_bono: ejecuta por el ejecutor con origen MANUAL_ADMIN", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const suscripcion = await crearSuscripcionActiva();
        const { rec } = await crearReglaYRec(admin.id, true);
        await prisma.recomendacion.update({
            where: { id: rec.id },
            data: { sujetoTipo: "Suscripcion", sujetoId: suscripcion.id },
        });

        const res = await llamar(rec.id);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.recomendacion.estado).toBe("APLICADA");
        expect(body.ejecucion.estado).toBe("EJECUTADA");
        expect(body.ejecucion.origenEjecucion).toBe("MANUAL_ADMIN");
        expect(body.ejecucion.resultado.bonoId).toBeDefined();
    });

    it("401 sin sesión", async () => {
        const res = await llamar("cualquiera");
        expect(res.status).toBe(401);
    });

    it("403 con rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await llamar("cualquiera");
        expect(res.status).toBe(403);
    });

    it("404 recomendación inexistente", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await llamar("rec-inexistente");
        expect(res.status).toBe(404);
    });

    it("409 si la recomendación no está PENDIENTE", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const { rec } = await crearReglaYRec(admin.id, false);
        await prisma.recomendacion.update({ where: { id: rec.id }, data: { estado: "IGNORADA" } });

        const res = await llamar(rec.id);
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("CONFLICT");
    });
});
