/**
 * SPEC-222 (002-PI-123): tests de integración de
 * GET /api/admin/analisis/dispersion. BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { periodoActualBogota } from "@/lib/analisis/periodos";
import { prisma } from "@/lib/prisma";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, EstadoPago, MetodoPago } from "@prisma/client";

let mockToken: string | undefined;

vi.mock("next/headers", () => ({
    cookies: async () => ({
        get: (name: string) =>
            name === "token" && mockToken ? { name: "token", value: mockToken } : undefined,
    }),
}));

const URL = "http://localhost:5005/api/admin/analisis/dispersion";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function crearSuscripcionConMetricas(
    repo: PagosRepository,
    planId: string,
    padreId: string,
    data: { monto: number; score?: number }
) {
    const suscripcion = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padreId,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: planId,
        fechaInicio: new Date(Date.now() - 30 * 86_400_000),
        fechaFin: new Date(Date.now() + 335 * 86_400_000),
        codigoReferidoPropio: unico("REF-222-DISP"),
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    await repo.crearPago({
        suscripcionId: suscripcion.id,
        duracionCubierta: DuracionPlan.MES_1,
        montoBaseUSD: data.monto,
        montoNetoUSD: data.monto,
        tasaCambioAplicada: 4000,
        montoLocalPagado: data.monto * 4000,
        monedaLocal: "COP",
        metodoDeclarado: MetodoPago.TRANSFERENCIA,
        comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
        comprobanteMimeType: "image/jpeg",
        comprobanteHashSha256: unico("hash"),
        fechaReporte: new Date(),
        fechaAutorizacion: new Date(),
        estado: EstadoPago.AUTORIZADO,
    });
    if (data.score !== undefined) {
        await prisma.scoreCliente.create({
            data: {
                suscripcionId: suscripcion.id,
                periodo: periodoActualBogota(),
                pesoReportes: 3,
                pesoCasos: 5,
                pesoAlertas: 2,
                pesoSesiones: 1,
                scoreTotal: data.score,
            },
        });
    }
    return suscripcion;
}

describe("GET /api/admin/analisis/dispersion", () => {
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

    it("devuelve puntos con cuadrante, cortes y conteo sin score", async () => {
        const repo = new PagosRepository();
        const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
        const padre = await crearUsuario(RolUsuario.PARENT, unico("padre") + "@test.co");
        const plan = await repo.crearPlan({
            tipoTitular: TipoTitular.PADRE,
            duracion: DuracionPlan.MES_1,
            anio: 2026,
            nombre: unico("Plan 222 disp"),
            precioBaseUSD: 10,
            precio: 0,
            creadoPorAdminId: admin.id,
        });
        // 4 puntos, uno por cuadrante + 1 sin score.
        await crearSuscripcionConMetricas(repo, plan.id, padre.id, { monto: 200, score: 90 });
        await crearSuscripcionConMetricas(repo, plan.id, padre.id, { monto: 200, score: 10 });
        await crearSuscripcionConMetricas(repo, plan.id, padre.id, { monto: 10, score: 90 });
        await crearSuscripcionConMetricas(repo, plan.id, padre.id, { monto: 10, score: 10 });
        await crearSuscripcionConMetricas(repo, plan.id, padre.id, { monto: 50 });

        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        const res = await GET(new Request(URL));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.puntos).toHaveLength(4);
        expect(json.sinScore).toBe(1);
        expect(json.totalSuscripciones).toBe(5);
        expect(json.truncado).toBe(false);
        expect(json.cortes.fuente).toBe("mediana");
        // Cortes por mediana: montos [10,10,200,200] → 105; scores [10,10,90,90] → 50.
        expect(json.cortes.montoUSD).toBe(105);
        expect(json.cortes.score).toBe(50);

        const cuadrantes = Object.fromEntries(
            json.puntos.map((p: { montoUSD: number; scoreTotal: number; cuadrante: string }) => [
                `${p.montoUSD}-${p.scoreTotal}`,
                p.cuadrante,
            ])
        );
        expect(cuadrantes["200-90"]).toBe("estables");
        expect(cuadrantes["200-10"]).toBe("riesgo");
        expect(cuadrantes["10-90"]).toBe("oportunidad");
        expect(cuadrantes["10-10"]).toBe("atencion");

        // Contrato SC-006: ningún punto expone texto de reportes ni PII de reportes.
        for (const punto of json.puntos) {
            expect(Object.keys(punto).sort()).toEqual(
                ["cliente", "cuadrante", "montoUSD", "scoreTotal", "suscripcionId", "tipoTitular"].sort()
            );
        }
    });

    it("400 con query inválido (custom sin fechas)", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");
        expect((await GET(new Request(`${URL}?periodo=custom`))).status).toBe(400);
    });
});
