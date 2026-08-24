/**
 * SPEC-222 (002-PI-123): tests de integración de
 * GET /api/admin/analisis/kpis. BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, EstadoPago, MetodoPago } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const URL = "http://localhost:5005/api/admin/analisis/kpis";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

describe("GET /api/admin/analisis/kpis", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("rechaza sin autenticación (401) y rol no ADMIN (403)", async () => {
        expect((await GET(new Request(URL))).status).toBe(401);
        const padre = await crearUsuario(RolUsuario.PARENT, unico("padre") + "@test.co");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        expect((await GET(new Request(URL))).status).toBe(403);
    });

    it("devuelve los 7 KPIs con shape de contrato y zona Bogotá", async () => {
        const repo = new PagosRepository();
        const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
        const padre = await crearUsuario(RolUsuario.PARENT, unico("padre") + "@test.co");
        const plan = await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_12,
            anio: 2026,
            nombre: unico("Plan 222 kpi"),
            precioBaseUSD: 120,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        const suscripcion = await repo.crearSuscripcion({
            tipoTitular: TipoTitular.PADRE,
            usuarioId: padre.id,
            estado: EstadoSuscripcion.ACTIVA,
            planActualId: plan.id,
            fechaInicio: new Date(Date.now() - 60 * 86_400_000),
            fechaFin: new Date(Date.now() + 305 * 86_400_000),
            codigoReferidoPropio: unico("REF-222-KPI"),
            monedaLocal: "COP",
            paisCliente: "CO",
        });
        // Dos pagos autorizados: el segundo cuenta como renovación.
        for (const diasAtras of [50, 5]) {
            const fecha = new Date(Date.now() - diasAtras * 86_400_000);
            await repo.crearPago({
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
                comprobanteHashSha256: unico("hash"),
                fechaReporte: fecha,
                fechaAutorizacion: fecha,
                estado: EstadoPago.AUTORIZADO,
            });
        }
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.periodo.zona).toBe("America/Bogota");
        for (const clave of [
            "mau",
            "mrrUSD",
            "churnRatePct",
            "ltvUSD",
            "renovacionesPct",
            "conversionFreemiumPct",
            "referidosExitososPct",
        ]) {
            expect(json.kpis[clave]).toHaveProperty("valor");
            expect(json.kpis[clave]).toHaveProperty("deltaPct");
        }
        // MRR: 1 suscripción ACTIVA de 120 USD/año → 10 USD/mes.
        expect(json.kpis.mrrUSD.valor).toBe(10);
        // LTV: 20 USD acumulados en 1 suscripción con pagos.
        expect(json.kpis.ltvUSD.valor).toBe(20);
        // Sin usuarios con SesionLog ni cancelaciones: valores 0, sin romper.
        expect(json.kpis.mau.valor).toBe(0);
        expect(json.kpis.churnRatePct.valor).toBe(0);
    });

    it("400 con query inválido (rango custom invertido)", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await GET(new Request(`${URL}?periodo=custom&desde=2026-08-31&hasta=2026-08-01`))).status).toBe(400);
    });
});
