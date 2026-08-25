/**
 * SPEC-244 (002-PI-147): tests de integración de POST /api/padre/suscripcion/solicitar-plan.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion } from "@prisma/client";

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
    return new Request("http://localhost:5005/api/padre/suscripcion/solicitar-plan", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function seedPlanPadre(adminId: string) {
    const repo = new PagosRepository();
    return repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_3,
        anio: new Date().getFullYear(),
        nombre: "Padre · 3 meses",
        precioBaseUSD: 10,
        precioBaseCOP: 39_900,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

describe("POST /api/padre/suscripcion/solicitar-plan", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea una solicitud PENDIENTE_AUTORIZACION para un padre", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-sol-p-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sol-${Date.now()}@test.co`);
        const plan = await seedPlanPadre(admin.id);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ planId: plan.id }, mockToken));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.suscripcion.estado).toBe("PENDIENTE_AUTORIZACION");
        expect(json.desglose.subtotal).toBe(39_900);
    });

    it("rechaza si ya existe suscripción vigente", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-sol-p2-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sol2-${Date.now()}@test.co`);
        const plan = await seedPlanPadre(admin.id);
        const repo = new PagosRepository();
        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: "REF-SOL-001",
            monedaLocal: "COP",
            paisCliente: "CO",
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ planId: plan.id }, mockToken));
        expect(res.status).toBe(409);
    });

    it("rechaza plan de otro tipo de titular", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-sol-p3-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sol3-${Date.now()}@test.co`);
        const planColegio = await new PagosRepository().crearPlan({
            tipoTitular: TipoTitular.COLEGIO,
            duracion: DuracionPlan.MES_12,
            anio: new Date().getFullYear(),
            nombre: "Colegio · Anual",
            precioBaseUSD: 100,
            precioBaseCOP: 599_000,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ planId: planColegio.id }, mockToken));
        expect(res.status).toBe(400);
    });

    it("rechaza roles distintos a PARENT", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-sol-p4-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await POST(crearRequest({ planId: "plan-1" }, mockToken));
        expect(res.status).toBe(403);
    });
});
