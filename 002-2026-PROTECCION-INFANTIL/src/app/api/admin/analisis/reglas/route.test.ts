/**
 * SPEC-224 (002-PI-125, FR-002/FR-003/FR-004/FR-005): tests de integración de
 * GET/POST /api/admin/analisis/reglas — auth 401/403, validación 400, clave
 * duplicada 409, orden por prioridad, conteo 7d y AuditLog REGLA_CREADA.
 * NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET, POST } from "./route";
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
            clave: unico("regla.panel"),
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

function llamarGet(qs = "") {
    return GET(crearRequestAutenticado("GET", `${URL_BASE}${qs}`, undefined, mockToken));
}

function llamarPost(body: unknown) {
    return POST(crearRequestAutenticado("POST", URL_BASE, body, mockToken));
}

const BODY_CREACION = {
    nombre: "Vencimientos en 7 días",
    descripcion: "Suscripciones activas que vencen en la próxima semana",
    categoria: "renovacion",
    sqlQuery: "SELECT s.id AS \"suscripcionId\" FROM \"suscripciones\" s WHERE s.estado = 'ACTIVA'",
    plantillaRecomendacion: "Llama a {{colegio}} · vence {{fechaFin}}",
    prioridad: 80,
    frecuenciaMin: 60,
};

describe("GET /api/admin/analisis/reglas", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("401: sin sesión", async () => {
        const res = await llamarGet();
        expect(res.status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await llamarGet();
        expect(res.status).toBe(403);
    });

    it("200: orden por prioridad descendente y conteo de generadas 7d", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const baja = await crearReglaDirecta(admin.id, { prioridad: 10 });
        const alta = await crearReglaDirecta(admin.id, { prioridad: 90 });
        await prisma.recomendacion.create({
            data: {
                reglaId: alta.id,
                titulo: "Sugerencia",
                descripcion: "Descripción",
                categoria: "renovacion",
                prioridad: 90,
                datosContexto: { dedupKey: unico("k") },
                expiraEn: new Date(Date.now() + 86_400_000),
            },
        });
        await prisma.recomendacion.create({
            data: {
                reglaId: baja.id,
                titulo: "Vieja",
                descripcion: "Descripción",
                categoria: "renovacion",
                prioridad: 10,
                datosContexto: { dedupKey: unico("k") },
                generadaEn: new Date(Date.now() - 30 * 86_400_000), // fuera de la ventana 7d
                expiraEn: new Date(Date.now() - 23 * 86_400_000),
            },
        });

        const res = await llamarGet();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.pagination.total).toBe(2);
        expect(body.items[0].id).toBe(alta.id);
        expect(body.items[0].recomendacionesGeneradas7d).toBe(1);
        expect(body.items[1].id).toBe(baja.id);
        expect(body.items[1].recomendacionesGeneradas7d).toBe(0);
        expect(body.items[0]).toMatchObject({ modo: "RECOMIENDA", activa: true, version: 1 });
    });

    it("200: filtro activa=false devuelve solo inactivas", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearReglaDirecta(admin.id, { activa: true });
        await crearReglaDirecta(admin.id, { activa: false });

        const res = await llamarGet("?activa=false");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.pagination.total).toBe(1);
        expect(body.items[0].activa).toBe(false);
    });
});

describe("POST /api/admin/analisis/reglas", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("201: crea en RECOMIENDA, activa, version 1 y audita REGLA_CREADA", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamarPost({ ...BODY_CREACION, clave: unico("test.crear") });
        expect(res.status).toBe(201);
        const body = await res.json();
        expect(body).toMatchObject({ modo: "RECOMIENDA", activa: true, version: 1, prioridad: 80 });

        const audit = await prisma.auditLog.findFirst({
            where: { accion: "REGLA_CREADA", recursoId: body.id, usuarioId: admin.id },
        });
        expect(audit).not.toBeNull();
        // Sin historial en la creación (US-4 escenario 3).
        const historial = await prisma.reglaRecomendacionHistorial.count({ where: { reglaId: body.id } });
        expect(historial).toBe(0);
    });

    it("409: clave duplicada", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const clave = unico("test.dup");
        await crearReglaDirecta(admin.id, { clave });

        const res = await llamarPost({ ...BODY_CREACION, clave });
        expect(res.status).toBe(409);
        const body = await res.json();
        expect(body.error.code).toBe("CONFLICT");
    });

    it("400: payload inválido (prioridad fuera de rango, clave malformada)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        for (const body of [
            { ...BODY_CREACION, clave: unico("test.p"), prioridad: 101 },
            { ...BODY_CREACION, clave: "Clave Invalida" },
            { ...BODY_CREACION, clave: unico("test.f"), frecuenciaMin: 1 },
        ]) {
            const res = await llamarPost(body);
            expect(res.status).toBe(400);
        }
    });

    it("400: query con intención de mutación se rechaza en el servidor", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamarPost({ ...BODY_CREACION, clave: unico("test.mut"), sqlQuery: "DELETE FROM \"suscripciones\"" });
        expect(res.status).toBe(400);
        const body = await res.json();
        expect(body.error.code).toBe("VALIDATION_ERROR");
        const creadas = await prisma.reglaRecomendacion.count();
        expect(creadas).toBe(0);
    });
});
