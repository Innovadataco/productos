/**
 * SPEC-211 (002-PI-111): tests de integración de GET /api/pagos/suscripcion.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function crearRequest(): Request {
    return new Request("http://localhost:5005/api/pagos/suscripcion", { method: "GET" });
}

async function seedSuscripcionPadre() {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-vista-${Date.now()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, `padre-vista-${Date.now()}@test.co`);
    const anio = new Date().getFullYear();
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio,
        nombre: "Plan padre mensual",
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-VISTA-${Date.now()}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    return { padre, plan, suscripcion };
}

describe("GET /api/pagos/suscripcion", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve la suscripción propia del padre con los campos del contrato", async () => {
        const { padre, suscripcion } = await seedSuscripcionPadre();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await GET(crearRequest());

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.id).toBe(suscripcion.id);
        expect(json.estado).toBe("ACTIVA");
        expect(json.plan.precioBaseUSD).toBe(10);
        expect(json.codigoReferidoPropio).toBe(suscripcion.codigoReferidoPropio);
        expect(json).toHaveProperty("diasRestantes");
        expect(json).toHaveProperty("totalPagadoUSD");
        expect(json).toHaveProperty("opcionesRenovacion");
        expect(json).toHaveProperty("limitesComprobante");
        expect(json.pagoPendiente).toBeNull();
    });

    it("devuelve la suscripción del colegio para SCHOOL_ADMIN", async () => {
        const repo = new PagosRepository();
        const { colegio, admin: schoolAdmin } = await crearColegioConAdmin();
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-vista-col-${Date.now()}@test.co`);
        const plan = await repo.crearPlan({
            tipoTitular: TipoTitular.COLEGIO,
            duracion: DuracionPlan.MES_12,
            anio: new Date().getFullYear(),
            nombre: "Plan colegio anual",
            precioBaseUSD: 100,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.COLEGIO,
            colegioId: colegio.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: `REF-COL-VISTA-${Date.now()}`,
            monedaLocal: "COP",
            paisCliente: "CO",
        });
        mockToken = await crearTokenUsuario(schoolAdmin.id, RolUsuario.SCHOOL_ADMIN);

        const res = await GET(crearRequest());

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.plan.nombre).toBe("Plan colegio anual");
    });

    it("devuelve 404 si el titular no tiene suscripción", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sinsub-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await GET(crearRequest());

        expect(res.status).toBe(404);
    });

    it("rechaza roles distintos a SCHOOL_ADMIN o PARENT", async () => {
        const operador = await crearUsuario(RolUsuario.OPERADOR, `operador-vista-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(operador.id, RolUsuario.OPERADOR);

        const res = await GET(crearRequest());

        expect(res.status).toBe(403);
    });

    it("rechaza sin autenticación", async () => {
        const res = await GET(crearRequest());
        expect(res.status).toBe(401);
    });
});
