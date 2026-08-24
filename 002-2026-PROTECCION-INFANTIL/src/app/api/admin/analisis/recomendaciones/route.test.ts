/**
 * SPEC-227 (002-PI-128): tests de integración de GET /api/admin/analisis/recomendaciones
 * (FR-001/002/003, SC-005): auth 401/403, filtros 400, paginación estándar y
 * shape del contrato. NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { EstadoRecomendacion } from "@prisma/client";
import { GET } from "./route";
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

async function crearReglaYRecomendaciones(
    adminId: string,
    cantidades: Partial<Record<EstadoRecomendacion, number>>
) {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.route"),
            nombre: "Regla de prueba",
            descripcion: "Regla",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
        },
    });
    let creadas = 0;
    for (const [estado, cantidad] of Object.entries(cantidades)) {
        for (let i = 0; i < (cantidad ?? 0); i++) {
            creadas += 1;
            const generadaEn = new Date(Date.UTC(2026, 7, 1, 12, 0, creadas));
            await prisma.recomendacion.create({
                data: {
                    reglaId: regla.id,
                    titulo: `Sugerencia ${creadas}`,
                    descripcion: "Descripción",
                    categoria: "renovacion",
                    prioridad: 80,
                    sujetoTipo: "Suscripcion",
                    sujetoId: unico("suj"),
                    datosContexto: { dedupKey: unico("k") },
                    estado: estado as EstadoRecomendacion,
                    generadaEn,
                    resueltaEn: estado === "PENDIENTE" ? null : new Date(Date.UTC(2026, 7, 2, 12, 0, creadas)),
                    expiraEn: new Date(generadaEn.getTime() + 7 * 86_400_000),
                },
            });
        }
    }
    return regla;
}

function llamar(qs = "") {
    return GET(crearRequestAutenticado("GET", `${URL_BASE}${qs}`, undefined, mockToken));
}

describe("GET /api/admin/analisis/recomendaciones", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: lista paginada con el shape del contrato, ordenada por generadaEn desc", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await crearReglaYRecomendaciones(admin.id, { PENDIENTE: 2, IGNORADA: 1 });

        const res = await llamar();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.pagination).toEqual({ page: 1, pageSize: 25, total: 3, totalPages: 1 });
        expect(body.items).toHaveLength(3);
        const [primero] = body.items;
        expect(primero.regla).toMatchObject({ id: regla.id, clave: regla.clave, nombre: regla.nombre });
        expect(primero).toHaveProperty("titulo");
        expect(primero).toHaveProperty("generadaEn");
        expect(primero).toHaveProperty("ejecutadaAutomatica");
        expect(body.items[0].generadaEn > body.items[1].generadaEn).toBe(true);
    });

    it("200: filtro por estado devuelve solo ese subconjunto", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearReglaYRecomendaciones(admin.id, { PENDIENTE: 2, IGNORADA: 3 });

        const res = await llamar("?estado=IGNORADA");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.pagination.total).toBe(3);
        expect(body.items.every((i: { estado: string }) => i.estado === "IGNORADA")).toBe(true);
    });

    it("200: paginación page=2 con 30 filas devuelve las 5 restantes", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await crearReglaYRecomendaciones(admin.id, { PENDIENTE: 30 });

        const res = await llamar("?page=2");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.items).toHaveLength(5);
        expect(body.pagination).toEqual({ page: 2, pageSize: 25, total: 30, totalPages: 2 });
    });

    it("400: filtro inválido (estado fuera del enum, fecha inexistente, rango invertido)", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        for (const qs of ["?estado=BORRADA", "?desde=2026-02-30", "?desde=2026-08-31&hasta=2026-08-01"]) {
            const res = await llamar(qs);
            expect(res.status).toBe(400);
            const body = await res.json();
            expect(body.error.code).toBe("VALIDATION_ERROR");
        }
    });

    it("401: sin sesión", async () => {
        mockToken = undefined;
        const res = await llamar();
        expect(res.status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.local");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");

        const res = await llamar();
        expect(res.status).toBe(403);
    });
});
