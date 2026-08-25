/**
 * SPEC-247 (002-PI-150): tests de integración de GET /api/pagos/suscripcion/estado.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
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

function crearRequest(): Request {
    return new Request("http://localhost:5005/api/pagos/suscripcion/estado", { method: "GET" });
}

describe("GET /api/pagos/suscripcion/estado", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("devuelve el estado de la suscripción activa del padre", async () => {
        const repo = new PagosRepository();
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-estado-${Date.now()}@test.co`);
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-estado-${Date.now()}@test.co`);
        const plan = await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: new Date().getFullYear(),
            nombre: "Plan mensual",
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: `REF-EST-${Date.now()}`,
            monedaLocal: "COP",
            paisCliente: "CO",
        });
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await GET(crearRequest());

        expect(res.status).toBe(200);
        const json = (await res.json()) as { estado: string };
        expect(json.estado).toBe("ACTIVA");
    });

    it("devuelve INEXISTENTE si el titular no tiene suscripción", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-sin-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await GET(crearRequest());

        expect(res.status).toBe(200);
        const json = (await res.json()) as { estado: string };
        expect(json.estado).toBe("INEXISTENTE");
    });

    it("rechaza sin autenticación", async () => {
        const res = await GET(crearRequest());
        expect(res.status).toBe(401);
    });
});
