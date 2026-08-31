/**
 * SPEC-211 (002-PI-111): tests de integración de POST /api/pagos/suscripcion/cancelar.
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

function crearRequest(body: unknown): Request {
    return new Request("http://localhost:5005/api/pagos/suscripcion/cancelar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

async function seedSuscripcion(estado: EstadoSuscripcion = EstadoSuscripcion.ACTIVA) {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-canc-${Date.now()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, `padre-canc-${Date.now()}@test.co`);
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio: new Date().getFullYear(),
        nombre: "Plan padre mensual",
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-CANC-${Date.now()}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    return { padre, suscripcion, repo };
}

describe("POST /api/pagos/suscripcion/cancelar", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("cancela la suscripción propia preservando los datos (borrado lógico)", async () => {
        const { padre, suscripcion, repo } = await seedSuscripcion();
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id, motivo: "Ya no la necesito" }));

        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.estado).toBe("CANCELADA");
        expect(json.canceladaEn).toBeDefined();

        const actualizada = await repo.obtenerSuscripcionPorId(suscripcion.id);
        expect(actualizada?.estado).toBe(EstadoSuscripcion.CANCELADA);
        expect(actualizada?.canceladaPorUsuario).toBe(true);
        expect(actualizada?.motivoCancelacion).toBe("Ya no la necesito");

        // SPEC-337 (I-227): al cancelar se re-sella `sesion_estado` → el corte de
        // acceso es inmediato (el middleware gatea al padre sin esperar un refresh).
        const setCookies = res.headers.getSetCookie?.() ?? res.headers.get("set-cookie") ?? "";
        const cookieStr = Array.isArray(setCookies) ? setCookies.join("; ") : setCookies;
        expect(cookieStr).toContain("sesion_estado=");
    });

    it("rechaza con 409 si ya está cancelada", async () => {
        const { padre, suscripcion } = await seedSuscripcion(EstadoSuscripcion.CANCELADA);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id }));

        expect(res.status).toBe(409);
    });

    it("rechaza con 404 una suscripción ajena", async () => {
        const { suscripcion } = await seedSuscripcion();
        const otro = await crearUsuario(RolUsuario.PARENT, `otro-canc-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(otro.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ suscripcionId: suscripcion.id }));

        expect(res.status).toBe(404);
    });

    it("rechaza con 400 un body inválido", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, `padre-canc-val-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(padre.id, RolUsuario.PARENT);

        const res = await POST(crearRequest({ motivo: "sin id" }));

        expect(res.status).toBe(400);
    });

    it("rechaza roles distintos a SCHOOL_ADMIN o PARENT", async () => {
        const operador = await crearUsuario(RolUsuario.OPERADOR, `operador-canc-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(operador.id, RolUsuario.OPERADOR);

        const res = await POST(crearRequest({ suscripcionId: "sub-1" }));

        expect(res.status).toBe(403);
    });
});
