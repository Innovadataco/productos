/**
 * SPEC-212 (002-PI-112): tests de integración de /api/admin/pagos/pendientes.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    EstadoPago,
    MetodoPago,
} from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

async function seedPagoPendiente() {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, `admin-pagos-${Date.now()}@test.co`);
    const padre = await crearUsuario(RolUsuario.PARENT, `padre-${Date.now()}@test.co`);
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio: 2026,
        nombre: "Plan test",
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
        codigoReferidoPropio: `REF-${Date.now()}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    const pago = await repo.crearPago({
        suscripcionId: suscripcion.id,
        duracionCubierta: DuracionPlan.MES_1,
        montoBaseUSD: 10,
        montoNetoUSD: 10,
        tasaCambioAplicada: 4000,
        montoLocalPagado: 40000,
        monedaLocal: "COP",
        metodoDeclarado: MetodoPago.TRANSFERENCIA,
        comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
        comprobanteMimeType: "image/jpeg",
        comprobanteHashSha256: "abc123",
        fechaReporte: new Date(),
        estado: EstadoPago.PENDIENTE_AUTORIZACION,
    });
    return { admin, padre, pago, suscripcion };
}

describe("GET /api/admin/pagos/pendientes", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("retorna pagos pendientes para ADMIN", async () => {
        const { admin, pago } = await seedPagoPendiente();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(new Request("http://localhost:5005/api/admin/pagos/pendientes"));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.items[0].id).toBe(pago.id);
        expect(json.pagination.total).toBe(1);
    });

    it("filtra por email del titular", async () => {
        const { admin, padre } = await seedPagoPendiente();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(
            new Request(`http://localhost:5005/api/admin/pagos/pendientes?q=${encodeURIComponent(padre.email)}`)
        );
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
    });

    it("rechaza parámetros de consulta inválidos", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, `admin-val-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(new Request("http://localhost:5005/api/admin/pagos/pendientes?q=a"));
        expect(res.status).toBe(400);
    });

    it("rechaza usuarios no ADMIN", async () => {
        const parent = await crearUsuario(RolUsuario.PARENT, `parent-${Date.now()}@test.co`);
        mockToken = await crearTokenUsuario(parent.id, RolUsuario.PARENT);

        const res = await GET(new Request("http://localhost:5005/api/admin/pagos/pendientes"));
        expect(res.status).toBe(403);
    });
});
