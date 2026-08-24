/**
 * SPEC-222 (002-PI-123): tests de integración de
 * GET /api/admin/analisis/dinero-vs-valor. BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET } from "./route";
import { resetDatabase } from "@/lib/test-utils";
import { resetRateLimitStore } from "@/lib/rate-limit";
import { crearUsuario, crearTokenUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
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

const URL = "http://localhost:5005/api/admin/analisis/dinero-vs-valor";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

async function seedComercial() {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
    const { colegio, pais, ciudad } = await crearColegioConAdmin();
    const padre = await crearUsuario(RolUsuario.PARENT, unico("padre") + "@test.co");
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_12,
        anio: 2026,
        nombre: unico("Plan 222"),
        precioBaseUSD: 120,
        precio: 0,
        creadoPorAdminId: admin.id,
    });
    const suscripcionColegio = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.COLEGIO,
        colegioId: colegio.id,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(Date.now() - 30 * 86_400_000),
        fechaFin: new Date(Date.now() + 335 * 86_400_000),
        codigoReferidoPropio: unico("REF-222-COL"),
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    await repo.crearPago({
        suscripcionId: suscripcionColegio.id,
        duracionCubierta: DuracionPlan.MES_12,
        montoBaseUSD: 120,
        montoNetoUSD: 120,
        tasaCambioAplicada: 4000,
        montoLocalPagado: 480000,
        monedaLocal: "COP",
        metodoDeclarado: MetodoPago.TRANSFERENCIA,
        comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
        comprobanteMimeType: "image/jpeg",
        comprobanteHashSha256: "abc123",
        fechaReporte: new Date(),
        fechaAutorizacion: new Date(),
        estado: EstadoPago.AUTORIZADO,
    });
    const suscripcionPadre = await repo.crearSuscripcion({
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.ACTIVA,
        planActualId: plan.id,
        fechaInicio: new Date(Date.now() - 30 * 86_400_000),
        fechaFin: new Date(Date.now() + 335 * 86_400_000),
        codigoReferidoPropio: unico("REF-222-PAD"),
        codigoReferidoUsado: "PI-PADRE-REFERIDO",
        monedaLocal: "COP",
        paisCliente: "CO",
    });
    await repo.crearPago({
        suscripcionId: suscripcionPadre.id,
        duracionCubierta: DuracionPlan.MES_1,
        montoBaseUSD: 10,
        montoNetoUSD: 10,
        tasaCambioAplicada: 4000,
        montoLocalPagado: 40000,
        monedaLocal: "COP",
        metodoDeclarado: MetodoPago.TRANSFERENCIA,
        comprobanteAdjuntoUrl: "https://example.com/comp2.jpg",
        comprobanteMimeType: "image/jpeg",
        comprobanteHashSha256: "def456",
        fechaReporte: new Date(),
        fechaAutorizacion: new Date(),
        estado: EstadoPago.AUTORIZADO,
    });
    await prisma.scoreCliente.create({
        data: {
            suscripcionId: suscripcionColegio.id,
            periodo: periodoActualBogota(),
            pesoReportes: 3,
            pesoCasos: 5,
            pesoAlertas: 2,
            pesoSesiones: 1,
            scoreTotal: 80,
        },
    });
    return { admin, colegio, pais, ciudad, suscripcionColegio, suscripcionPadre };
}

describe("GET /api/admin/analisis/dinero-vs-valor", () => {
    beforeEach(async () => {
        await resetDatabase();
        await resetRateLimitStore();
        mockToken = undefined;
    });

    it("rechaza sin autenticación (401)", async () => {
        const res = await GET(new Request(URL));
        expect(res.status).toBe(401);
    });

    it("rechaza rol distinto de ADMIN (403)", async () => {
        const padre = await crearUsuario(RolUsuario.PARENT, unico("padre") + "@test.co");
        mockToken = await crearTokenUsuario(padre.id, "PARENT");
        const res = await GET(new Request(URL));
        expect(res.status).toBe(403);
    });

    it("400: periodo=custom sin fechas, rango invertido y granularidad inválida", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        expect((await GET(new Request(`${URL}?periodo=custom`))).status).toBe(400);
        expect(
            (await GET(new Request(`${URL}?periodo=custom&desde=2026-08-31&hasta=2026-08-01`))).status
        ).toBe(400);
        expect((await GET(new Request(`${URL}?granularidad=galaxia`))).status).toBe(400);
        expect((await GET(new Request(`${URL}?pageSize=101`))).status).toBe(400);
    });

    it("granularidad pais: agrega recaudo y score del período (SC-003)", async () => {
        const { admin } = await seedComercial();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request(`${URL}?granularidad=pais`));
        expect(res.status).toBe(200);
        const json = await res.json();

        expect(json.totales.suscripciones).toBe(2);
        expect(json.totales.recaudoUSD).toBe(130);
        expect(json.totales.scorePromedio).toBe(80);
        expect(json.totales.sinScore).toBe(1);

        const filaColombia = json.items.find((i: { etiqueta: string }) => i.etiqueta === "Colombia");
        expect(filaColombia).toBeDefined();
        expect(filaColombia.recaudoUSD).toBe(120);
        expect(filaColombia.drill).toMatchObject({ granularidad: "ciudad" });
    });

    it("granularidad canal: precedencia referido (FR-018)", async () => {
        const { admin } = await seedComercial();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request(`${URL}?granularidad=canal`));
        expect(res.status).toBe(200);
        const json = await res.json();

        const referido = json.items.find((i: { etiqueta: string }) => i.etiqueta === "Referido");
        const directo = json.items.find((i: { etiqueta: string }) => i.etiqueta === "Directo");
        expect(referido.recaudoUSD).toBe(10);
        expect(directo.recaudoUSD).toBe(120);
    });

    it("paginación estándar { items, pagination }", async () => {
        const { admin } = await seedComercial();
        mockToken = await crearTokenUsuario(admin.id, "ADMIN");

        const res = await GET(new Request(`${URL}?granularidad=padre&page=1&pageSize=1`));
        expect(res.status).toBe(200);
        const json = await res.json();
        expect(json.items).toHaveLength(1);
        expect(json.pagination).toMatchObject({ page: 1, pageSize: 1, total: 1, totalPages: 1 });
    });
});
