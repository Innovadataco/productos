/**
 * SPEC-244 (002-PI-147): tests de integración de POST /api/padre/suscripcion/activar-freemium.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, TipoTitular, DuracionPlan, OrigenSuscripcion, EstadoSuscripcion } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function crearRequest(body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request("http://localhost:5005/api/padre/suscripcion/activar-freemium", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function seedPlanFreemium(adminId: string) {
    const repo = new PagosRepository();
    return repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio: new Date().getFullYear(),
        nombre: "Prueba gratis 30 días",
        precioBaseUSD: 0,
        precioBaseCOP: 0,
        precio: 0,
        esFreemium: true,
        usosMaximosPorCliente: 1,
        creadoPorAdminId: adminId,
    });
}

describe("POST /api/padre/suscripcion/activar-freemium", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("activa freemium para un padre", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-free-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-free-${Date.now()}@test.co`);
        await seedPlanFreemium(admin.id);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ aceptaTerminos: true }, mockToken));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.estado).toBe("ACTIVA");
        expect(json.esFreemium).toBe(true);
        expect(json.freemiumFechaFin).toBeDefined();
    });

    it("rechaza si el padre ya activó freemium antes", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-free2-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-free2-${Date.now()}@test.co`);
        const plan = await seedPlanFreemium(admin.id);
        const repo = new PagosRepository();
        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            origen: OrigenSuscripcion.FREEMIUM_AUTO,
            esFreemium: true,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-FREE-PREV",
            monedaLocal: "COP",
            paisCliente: "CO",
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ aceptaTerminos: true }, mockToken));
        expect(res.status).toBe(409);
    });

    it("rechaza si no hay plan freemium activo", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-free3-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-free3-${Date.now()}@test.co`);
        // Solo plan pago
        await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_3,
            anio: new Date().getFullYear(),
            nombre: "Padre · 3 meses",
            precioBaseUSD: 10,
            precioBaseCOP: 39_900,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ aceptaTerminos: true }, mockToken));
        expect(res.status).toBe(404);
    });

    it("rechaza body inválido", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-free4-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ aceptaTerminos: false }, mockToken));
        expect(res.status).toBe(400);
    });
});
