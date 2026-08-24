/**
 * SPEC-218 (002-PI-118): tests de integración de
 * GET /api/admin/estadisticas/dinero-vs-valor. BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { invalidarCacheAnalitica } from "@/lib/pagos/analitica.service";
import {
    RolUsuario,
    TipoTitular,
    DuracionPlan,
    EstadoSuscripcion,
    EstadoPago,
    MetodoPago,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

function nuevoEmail() {
    return `test-218-${Date.now()}-${Math.random().toString(36).slice(2)}@test.co`;
}

let correlativo = 0;
async function seedBase() {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, nuevoEmail());
    const padre = await crearUsuario(RolUsuario.PARENT, nuevoEmail());
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.PADRE,
        duracion: DuracionPlan.MES_1,
        anio: 2026,
        nombre: "Plan test 218",
        precioBaseUSD: 10,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    correlativo += 1;
    // Suscripción ACTIVA que vence en 3 días (widget vencimientos) + pago autorizado del mes.
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-218-ROUTE-${Date.now()}-${correlativo}`,
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
        estado: EstadoPago.AUTORIZADO,
    });
    // Suscripción SUSPENDIDA con 40 días de mora (widget mora larga).
    correlativo += 1;
    await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.SUSPENDIDA,
        planActualId: plan.id,
        fechaInicio: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000),
        fechaFin: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        codigoReferidoPropio: `REF-218-ROUTE-${Date.now()}-${correlativo}`,
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    return { admin, padre, plan, suscripcion, pago };
}

describe("GET /api/admin/estadisticas/dinero-vs-valor", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        invalidarCacheAnalitica();
        mockToken = undefined;
    });

    it("rechaza sin autenticación", async () => {
        const res = await GET(new Request("http://localhost:5005/api/admin/estadisticas/dinero-vs-valor"));
        expect(res.status).toBe(401);
    });

    it("devuelve KPIs y los 4 widgets para ADMIN", async () => {
        const { admin, suscripcion } = await seedBase();
        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);

        const res = await GET(new Request("http://localhost:5005/api/admin/estadisticas/dinero-vs-valor"));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.kpi.recaudoMesActualUSD).toBe(10);
        expect(json.kpi.activas).toBe(1);
        expect(json.kpi.suspendidas).toBe(1);
        expect(json.kpi.nuevasEsteMes).toBe(2);

        const vencimientos = json.widgets.vencimientosEstaSemana;
        expect(vencimientos.total).toBe(1);
        expect(vencimientos.items[0].suscripcionId).toBe(suscripcion.id);
        expect(vencimientos.items[0].diasRestantes).toBeGreaterThanOrEqual(2);
        expect(vencimientos.items[0].diasRestantes).toBeLessThanOrEqual(3);

        const mora = json.widgets.moraLarga;
        expect(mora.total).toBe(1);
        expect(mora.items[0].diasMora).toBeGreaterThanOrEqual(40);
        expect(mora.items[0].estado).toBe(EstadoSuscripcion.SUSPENDIDA);

        expect(json.widgets.crecimientoPaisCiudad.labels).toHaveLength(6);
        expect(json.widgets.crecimientoPaisCiudad.series[0].pais).toBe("CO");
    });

    it("detecta padres pagantes de colegios no renovados", async () => {
        const { admin, plan } = await seedBase();
        const repo = new PagosRepository();
        const { colegio, tenant } = await crearColegioConAdmin();

        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.COLEGIO,
            colegioId: colegio.id,
            estado: EstadoSuscripcion.CANCELADA,
            planActualId: plan.id,
            fechaInicio: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
            fechaFin: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: `REF-218-COL-${Date.now()}`,
            monedaLocal: "COP",
            paisCliente: "CO",
        });
        const padreTenant = await prisma.usuario.create({
            data: {
                email: nuevoEmail(),
                passwordHash: "hash",
                rol: RolUsuario.PARENT,
                estado: "activo",
                tenantId: tenant.id,
            },
        });
        await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padreTenant.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(),
            fechaFin: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            codigoReferidoPropio: `REF-218-PAD-${Date.now()}`,
            monedaLocal: "COP",
            paisCliente: "CO",
        });

        mockToken = await crearTokenUsuario(admin.id, RolUsuario.ADMIN);
        const res = await GET(new Request("http://localhost:5005/api/admin/estadisticas/dinero-vs-valor"));
        expect(res.status).toBe(200);
        const json = await res.json();

        const widget = json.widgets.padresPagantesColegiosCaidos;
        expect(widget.total).toBe(1);
        expect(widget.items[0].colegioId).toBe(colegio.id);
        expect(widget.items[0].colegioEstado).toBe(EstadoSuscripcion.CANCELADA);
        expect(widget.items[0].rectorEmail).toBe("rep@test.com");
    });
});
