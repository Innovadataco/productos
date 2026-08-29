/**
 * SPEC-222 (002-PI-123): tests de integración de
 * GET /api/admin/analisis/top-decisiones. BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const URL = "http://localhost:5005/api/admin/analisis/top-decisiones";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearRecomendacion(
    adminId: string,
    data: { prioridad: number; expiraEn?: Date; titulo?: string }
) {
    const regla = await prisma.reglaRecomendacion.create({
        data: {
            clave: unico("regla.222"),
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
            titulo: data.titulo ?? `Recomendación ${data.prioridad}`,
            descripcion: "Descripción",
            categoria: "renovacion",
            prioridad: data.prioridad,
            datosContexto: { telefono: "+573001112233", email: "contacto@test.co" },
            expiraEn: data.expiraEn ?? new Date(Date.now() + 86_400_000),
        },
    });
}

describe("GET /api/admin/analisis/top-decisiones", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("rechaza sin autenticación (401)", async () => {
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("rechaza rol distinto de ADMIN (403)", async () => {
        const padre = await crearUsuario("PARENT", unico("padre") + "@test.co");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET(new Request(URL));
        expect(res.status).toBe(403);
    });

    it("devuelve máximo 5 ordenadas por prioridad DESC y excluye expiradas", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.co");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        // 6 vigentes + 1 expirada: deben quedar las 5 de mayor prioridad.
        for (const prioridad of [10, 90, 50, 70, 30, 60]) {
            await crearRecomendacion(admin.id, { prioridad });
        }
        await crearRecomendacion(admin.id, {
            prioridad: 100,
            titulo: "Expirada",
            expiraEn: new Date(Date.now() - 86_400_000),
        });

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.items).toHaveLength(5);
        expect(json.items.map((i: { prioridad: number }) => i.prioridad)).toEqual([90, 70, 60, 50, 30]);
        expect(json.items.some((i: { titulo: string }) => i.titulo === "Expirada")).toBe(false);
        // Contacto derivado de datosContexto (FR-014).
        expect(json.items[0].contacto).toEqual({ telefono: "+573001112233", email: "contacto@test.co" });
    });

    it("estado vacío sin recomendaciones pendientes", async () => {
        const admin = await crearUsuario("ADMIN", unico("admin") + "@test.co");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toEqual([]);
    });
});
