/**
 * SPEC-227 (002-PI-128): tests de integración de
 * GET /api/admin/analisis/recomendaciones/metricas (FR-004, SC-002/005):
 * contrato de métricas, denominador de resueltas, auth 401/403 y filtros 400.
 * NOTA: integración (BD compartida) — los corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
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

const URL_BASE = "http://localhost:5005/api/admin/analisis/recomendaciones/metricas";

async function sembrarDataset(adminId: string) {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.met"),
            nombre: "Regla métricas",
            descripcion: "Regla",
            categoria: "renovacion",
            sqlQuery: "SELECT 1",
            plantillaRecomendacion: "Título",
            creadaPorAdminId: adminId,
        },
    });
    const crear = (estado: "PENDIENTE" | "APLICADA" | "IGNORADA") =>
        prisma.recomendacion.create({
            data: {
                reglaId: regla.id,
                titulo: "Sugerencia",
                descripcion: "Descripción",
                categoria: "renovacion",
                prioridad: 80,
                datosContexto: { dedupKey: unico("k") },
                estado,
                generadaEn: new Date("2026-08-20T14:00:00.000Z"),
                resueltaEn:
                    estado === "PENDIENTE" ? null : new Date("2026-08-21T14:00:00.000Z"),
                expiraEn: new Date("2026-08-27T14:00:00.000Z"),
            },
        });
    for (let i = 0; i < 2; i++) await crear("APLICADA");
    for (let i = 0; i < 8; i++) await crear("IGNORADA");
    for (let i = 0; i < 3; i++) await crear("PENDIENTE");
    return regla;
}

function llamar(qs = "") {
    return GET(crearRequestAutenticado("GET", `${URL_BASE}${qs}`, undefined, mockToken));
}

describe("GET /api/admin/analisis/recomendaciones/metricas", () => {
    beforeEach(async () => {
        await resetDatabase();
        mockToken = undefined;
    });

    it("200: contrato de métricas con tasas sobre resueltas y porRegla", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const regla = await sembrarDataset(admin.id);

        const res = await llamar();
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.totalGeneradas).toBe(13);
        expect(body.totalResueltas).toBe(10);
        expect(body.pendientes).toBe(3);
        expect(body.tasaAplicacionPct).toBe(20);
        expect(body.tasaIgnoradaPct).toBe(80);
        expect(body.tasaExpiradaPct).toBe(0);
        expect(body.tiempoPromedioResolucionHoras).toBe(24);
        expect(body.umbralAlertaIgnoradaPct).toBe(70);
        expect(body.porRegla).toHaveLength(1);
        expect(body.porRegla[0]).toMatchObject({
            reglaId: regla.id,
            reglaClave: regla.clave,
            totalGeneradas: 13,
            tasaIgnoradaPct: 80,
            sobreUmbralAlerta: true,
        });
    });

    it("200: eco del rango filtrado en la respuesta", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        await sembrarDataset(admin.id);

        const res = await llamar("?desde=2026-08-01&hasta=2026-08-31");
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.rango).toEqual({ desde: "2026-08-01", hasta: "2026-08-31" });
    });

    it("400: filtro inválido", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.local");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await llamar("?estado=CUALQUIERA");
        expect(res.status).toBe(400);
    });

    it("401: sin sesión", async () => {
        mockToken = undefined;
        const res = await llamar();
        expect(res.status).toBe(401);
    });

    it("403: rol distinto de ADMIN", async () => {
        const operador = await crearUsuario("OPERADOR", unico("op") + "@test.local");
        mockToken = await crearTokenUsuario(operador.id, "OPERADOR");

        const res = await llamar();
        expect(res.status).toBe(403);
    });
});
