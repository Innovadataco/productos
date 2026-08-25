/**
 * SPEC-244 (002-PI-147): tests de integración de GET /api/pagos/planes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, TipoTitular, DuracionPlan } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function crearRequest(token?: string): Request {
    const headers: Record<string, string> = {};
    if (token) headers.cookie = `token=${token}`;
    return new Request("http://localhost:5005/api/pagos/planes", { headers });
}

async function seedPlanes(adminId: string) {
    const repo = new PagosRepository();
    const anio = new Date().getFullYear();
    await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_3,
        anio,
        nombre: "Padre · 3 meses",
        precioBaseUSD: 10,
        precioBaseCOP: 39_900,
        precio: 0,
        creadoPorAdminId: adminId,
    });
    await repo.crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_12,
        anio,
        nombre: "Colegio · Anual",
        precioBaseUSD: 100,
        precioBaseCOP: 599_000,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

describe("GET /api/pagos/planes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve planes activos para padre", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-planes-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-planes-${Date.now()}@test.co`);
        await seedPlanes(admin.id);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await GET(crearRequest(mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.planes).toHaveLength(1);
        expect(json.planes[0]?.tipoTitular).toBe("PADRE");
    });

    it("devuelve planes activos para colegio", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-planes-c-${Date.now()}@test.co`);
        const { admin: schoolAdmin } = await crearColegioConAdmin();
        await seedPlanes(admin.id);
        mockToken = await crearTokenUsuario(schoolAdmin.id, RolUsuario.SCHOOL_ADMIN);

        const res = await GET(crearRequest(mockToken));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.planes).toHaveLength(1);
        expect(json.planes[0]?.tipoTitular).toBe("COLEGIO");
    });

    it("rechaza roles no autorizados", async () => {
        const operador = await crearUsuario(RolUsuario.OPERADOR, `op-planes-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(operador.id, RolUsuario.OPERADOR);

        const res = await GET(crearRequest(mockToken));
        expect(res.status).toBe(403);
    });
});
