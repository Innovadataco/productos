/**
 * SPEC-226 (002-PI-mega-cola, FR-011/FR-012/FR-016): tests de INTEGRACIÓN de
 * POST /api/admin/analisis/recomendaciones/[id]/revertir — 200 (bono
 * desactivado + REVERTIDA), 400 sin motivo, 401, 403, 404, 409 (nada que
 * revertir y segunda reversión). NOTA: integración (BD compartida) — los
 * corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearTokenUsuario, crearRequestAutenticado, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { ejecutarAccion } from "@/lib/analisis/acciones/ejecutor";

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
    return `http://localhost:5005/api/admin/analisis/recomendaciones/${id}/revertir`;
}

function llamar(id: string, body: unknown) {
    return POST(crearRequestAutenticado("POST", urlBase(id), body, mockToken), {
        params: Promise.resolve({ id }),
    });
}

const PARAMS_BONO = { tipoBono: "DESCUENTO_PCT", valor: 10, vigenciaDias: 7 };

async function crearEjecucionDeBono() {
    const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
    const { colegio } = await crearColegioConAdmin();
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
    const suscripcion = await prisma.suscripcion.create({
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
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.revertir"),
            nombre: "Regla revertir",
            descripcion: "Regla revertir",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            modo: "EJECUTA",
            accionEjecutable: "crear_bono",
            accionParametros: PARAMS_BONO,
            creadaPorAdminId: admin.id,
        },
    });
    const rec = await prisma.recomendacion.create({
        data: {
            reglaId: regla.id,
            titulo: "Sugerencia de prueba",
            descripcion: "Descripción",
            categoria: "renovacion",
            prioridad: 80,
            sujetoTipo: "Suscripcion",
            sujetoId: suscripcion.id,
            datosContexto: { dedupKey: unico("k") },
            accionSugerida: "crear_bono",
            accionParametros: PARAMS_BONO,
            expiraEn: new Date(Date.now() + 7 * 86_400_000),
        },
    });
    const ejecucion = await ejecutarAccion({ recomendacionId: rec.id, origen: "AUTOMATICA" });
    return { admin, rec, ejecucion };
}

describe("POST /api/admin/analisis/recomendaciones/[id]/revertir (SPEC-226)", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: bono desactivado, ejecución REVERTIDA con motivo y efectoReversion", async () => {
        const { admin, rec, ejecucion } = await crearEjecucionDeBono();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const bonoId = (ejecucion.resultado as Record<string, unknown>)["bonoId"] as string;

        const res = await llamar(rec.id, { motivo: "Descuento mayor al autorizado" });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.ejecucion.estado).toBe("REVERTIDA");
        expect(body.ejecucion.revertidaPorAdminId).toBe(admin.id);
        expect(body.ejecucion.motivoReversion).toBe("Descuento mayor al autorizado");
        expect(body.efectoReversion.tipo).toBe("CREAR_BONO");
        expect(body.efectoReversion.bonoId).toBe(bonoId);

        const bono = await prisma.bonoPromocional.findUnique({ where: { id: bonoId } });
        expect(bono?.activo).toBe(false);
    });

    it("409: segunda reversión sobre la misma recomendación", async () => {
        const { admin, rec } = await crearEjecucionDeBono();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const primera = await llamar(rec.id, { motivo: "Primera reversión" });
        expect(primera.status).toBe(200);
        const segunda = await llamar(rec.id, { motivo: "Segunda reversión" });
        expect(segunda.status).toBe(409);
    });

    it("400 sin motivo o motivo corto", async () => {
        const { admin, rec } = await crearEjecucionDeBono();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const sinBody = await llamar(rec.id, undefined);
        expect(sinBody.status).toBe(400);
        const corto = await llamar(rec.id, { motivo: "abc" });
        expect(corto.status).toBe(400);
    });

    it("401 sin sesión", async () => {
        const res = await llamar("cualquiera", { motivo: "Motivo válido" });
        expect(res.status).toBe(401);
    });

    it("403 con rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await llamar("cualquiera", { motivo: "Motivo válido" });
        expect(res.status).toBe(403);
    });

    it("404 recomendación inexistente", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await llamar("rec-inexistente", { motivo: "Motivo válido" });
        expect(res.status).toBe(404);
    });

    it("409 cuando no hay ejecución revertible", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await prisma.reglaRecomendacion.create({
            data: {
                clave: unico("regla.sinejec"),
                nombre: "Regla",
                descripcion: "Regla",
                categoria: "renovacion",
                sqlQuery: "SELECT 1",
                plantillaRecomendacion: "Título",
                creadaPorAdminId: admin.id,
            },
        });
        const rec = await prisma.recomendacion.create({
            data: {
                reglaId: regla.id,
                titulo: "Sugerencia",
                descripcion: "Descripción",
                categoria: "renovacion",
                prioridad: 80,
                datosContexto: { dedupKey: unico("k") },
                expiraEn: new Date(Date.now() + 7 * 86_400_000),
            },
        });

        const res = await llamar(rec.id, { motivo: "No hay nada que revertir" });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("CONFLICT");
    });
});
