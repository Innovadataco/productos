/**
 * SPEC-244 (002-PI-147): tests de integración de POST /api/colegio/suscripcion/solicitar-plan.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "./route";
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

function crearRequest(body: unknown, token?: string): Request {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.cookie = `token=${token}`;
    return new Request("http://localhost:5005/api/colegio/suscripcion/solicitar-plan", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

async function seedPlanColegio(adminId: string) {
    const repo = new PagosRepository();
    return repo.crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_12,
        anio: new Date().getFullYear(),
        nombre: "Colegio · Anual",
        precioBaseUSD: 100,
        precioBaseCOP: 599_000,
        precio: 0,
        creadoPorAdminId: adminId,
    });
}

describe("POST /api/colegio/suscripcion/solicitar-plan", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("crea una solicitud PENDIENTE_AUTORIZACION para un colegio", async () => {
        const adminPlataforma = await crearUsuario(RolUsuario.ADMIN, `admin-sol-c-${Date.now()}@test.co`);
        const { admin: schoolAdmin } = await crearColegioConAdmin();
        const plan = await seedPlanColegio(adminPlataforma.id);
        mockToken = await crearTokenUsuario(schoolAdmin.id, RolUsuario.SCHOOL_ADMIN);

        const res = await POST(crearRequest({ planId: plan.id }, mockToken));

        expect(res.status).toBe(201);
        const json = await res.json();
        expect(json.suscripcion.estado).toBe("PENDIENTE_AUTORIZACION");
        expect(json.desglose.subtotal).toBe(599_000);
    });

    it("rechaza admin de colegio sin colegio asociado", async () => {
        const adminPlataforma = await crearUsuario(RolUsuario.ADMIN, `admin-sol-c2-${Date.now()}@test.co`);
        const schoolAdminSinColegio = await crearUsuario(RolUsuario.SCHOOL_ADMIN, `school-sol-sinc-${Date.now()}@test.co`);
        const plan = await seedPlanColegio(adminPlataforma.id);
        mockToken = await crearTokenUsuario(schoolAdminSinColegio.id, RolUsuario.SCHOOL_ADMIN);

        const res = await POST(crearRequest({ planId: plan.id }, mockToken));
        expect(res.status).toBe(400);
    });

    it("rechaza roles distintos a SCHOOL_ADMIN", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sol-c-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ planId: "plan-1" }, mockToken));
        expect(res.status).toBe(403);
    });
});
