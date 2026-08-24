/**
 * SPEC-222 (002-PI-123): tests de integración del servicio del panel Dinero
 * vs Valor contra un dataset semilla conocido (SC-003: diferencia de recaudo
 * = 0 vs cálculo manual del fixture). BD compartida; corre el coordinador.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetDatabase } from "@/lib/test-utils";
import { crearUsuario, crearColegioConAdmin } from "@/lib/reporte-test-utils";
import { PagosRepository } from "@/lib/dal/repositories/pagos-repository";
import { periodoActualBogota } from "@/lib/analisis/periodos";
import { prisma } from "@/lib/prisma";
import { RolUsuario, TipoTitular, DuracionPlan, EstadoSuscripcion, EstadoPago, MetodoPago } from "@prisma/client";
import { AnalisisPanelService } from "./analisis-panel";

let consecutivo = 0;
function unico(prefijo: string) {
    consecutivo += 1;
    return `${prefijo}-${Date.now()}-${consecutivo}`;
}

interface Fixture {
    adminId: string;
    colegioId: string;
    paisId: string;
    ciudadId: string;
    suscripcionColegioId: string;
    suscripcionPadreReferidoId: string;
    suscripcionPadreSinScoreId: string;
}

async function seedPanel(): Promise<Fixture> {
    const repo = new PagosRepository();
    const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
    const { colegio, pais, ciudad } = await crearColegioConAdmin();
    const padre = await crearUsuario(RolUsuario.PARENT, unico("padre") + "@test.co");
    const plan = await repo.crearPlan({
        tipoTitular: TipoTitular.COLEGIO,
        duracion: DuracionPlan.MES_12,
        anio: 2026,
        nombre: unico("Plan 222 svc"),
        precioBaseUSD: 120,
        precio: 0,
        creadoPorAdminId: admin.id,
    });

    const crearPago = (suscripcionId: string, monto: number) =>
        repo.crearPago({
            suscripcionId,
            duracionCubierta: DuracionPlan.MES_1,
            montoBaseUSD: monto,
            montoNetoUSD: monto,
            tasaCambioAplicada: 4000,
            montoLocalPagado: monto * 4000,
            monedaLocal: "COP",
            metodoDeclarado: MetodoPago.TRANSFERENCIA,
            comprobanteAdjuntoUrl: "https://example.com/comp.jpg",
            comprobanteMimeType: "image/jpeg",
            comprobanteHashSha256: unico("hash"),
            fechaReporte: new Date(),
            fechaAutorizacion: new Date(),
            estado: EstadoPago.AUTORIZADO,
        });

    const crearScore = (suscripcionId: string, scoreTotal: number) =>
        prisma.scoreCliente.create({
            data: {
                suscripcionId,
                periodo: periodoActualBogota(),
                pesoReportes: 3,
                pesoCasos: 5,
                pesoAlertas: 2,
                pesoSesiones: 1,
                scoreTotal,
            },
        });

    const base = {
        planActualId: plan.id,
        fechaInicio: new Date(Date.now() - 30 * 86_400_000),
        fechaFin: new Date(Date.now() + 335 * 86_400_000),
        monedaLocal: "COP",
        paisCliente: "CO",
    };

    // Colegio: pago 120, score 80.
    const sColegio = await repo.crearSuscripcion({
        ...base,
        tipoTitular: TipoTitular.COLEGIO,
        colegioId: colegio.id,
        estado: EstadoSuscripcion.ACTIVA,
        codigoReferidoPropio: unico("REF-222-S1"),
    });
    await crearPago(sColegio.id, 120);
    await crearScore(sColegio.id, 80);

    // Padre referido: pago 10, score 90.
    const sPadreRef = await repo.crearSuscripcion({
        ...base,
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.ACTIVA,
        codigoReferidoPropio: unico("REF-222-S2"),
        codigoReferidoUsado: "PI-PADRE-REFSVC1",
    });
    await crearPago(sPadreRef.id, 10);
    await crearScore(sPadreRef.id, 90);

    // Padre directo sin score: pago 5.
    const sPadreSin = await repo.crearSuscripcion({
        ...base,
        tipoTitular: TipoTitular.PADRE,
        usuarioId: padre.id,
        estado: EstadoSuscripcion.ACTIVA,
        codigoReferidoPropio: unico("REF-222-S3"),
    });
    await crearPago(sPadreSin.id, 5);

    return {
        adminId: admin.id,
        colegioId: colegio.id,
        paisId: pais.id,
        ciudadId: ciudad.id,
        suscripcionColegioId: sColegio.id,
        suscripcionPadreReferidoId: sPadreRef.id,
        suscripcionPadreSinScoreId: sPadreSin.id,
    };
}

const QUERY_BASE = {
    periodo: "mes" as const,
    estado: "todas" as const,
    tipoTitular: "ambos" as const,
    page: 1,
    pageSize: 25,
};

describe("AnalisisPanelService.dineroVsValor", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("granularidad pais: recaudo exacto del fixture y score promedio sin contar ausentes", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({ ...QUERY_BASE, granularidad: "pais" });

        expect(res.totales).toMatchObject({ suscripciones: 3, recaudoUSD: 135, scorePromedio: 85, sinScore: 1 });
        const colombia = res.items.find((i) => i.etiqueta === "Colombia");
        expect(colombia).toMatchObject({ recaudoUSD: 120, scorePromedio: 80, semaforo: "pino" });
        const bucketPadres = res.items.find((i) => i.etiqueta === "CO");
        expect(bucketPadres).toBeDefined();
        expect(bucketPadres!).toMatchObject({ recaudoUSD: 15, scorePromedio: 90 });
        expect(bucketPadres!.drill).toBeNull();
    });

    it("granularidad ciudad: padres caen en bucket 'Sin ciudad'", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({ ...QUERY_BASE, granularidad: "ciudad" });

        const bogota = res.items.find((i) => i.etiqueta === "Bogotá");
        const sinCiudad = res.items.find((i) => i.etiqueta === "Sin ciudad");
        expect(bogota).toMatchObject({ recaudoUSD: 120, suscripciones: 1 });
        expect(sinCiudad).toMatchObject({ recaudoUSD: 15, suscripciones: 2 });
    });

    it("granularidad canal con precedencia (referido vs directo)", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({ ...QUERY_BASE, granularidad: "canal" });

        expect(res.items.map((i) => i.etiqueta)).toEqual(["Referido", "Directo"]);
        expect(res.items[0]).toMatchObject({ recaudoUSD: 10 });
        expect(res.items[1]).toMatchObject({ recaudoUSD: 125, suscripciones: 2 });
    });

    it("granularidad cohorte: clave YYYY-MM Bogotá con % retenidos", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({ ...QUERY_BASE, granularidad: "cohorte" });

        expect(res.items).toHaveLength(1);
        expect(res.items[0]!.clave).toMatch(/^\d{4}-\d{2}$/);
        expect(res.items[0]!.retenidosPct).toBe(100);
    });

    it("granularidad colegio: nivel hoja con suscripcionId para la vista cliente", async () => {
        const fixture = await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({ ...QUERY_BASE, granularidad: "colegio" });

        expect(res.items).toHaveLength(1);
        expect(res.items[0]).toMatchObject({
            etiqueta: "Colegio Test",
            recaudoUSD: 120,
            drill: null,
            suscripcionId: fixture.suscripcionColegioId,
        });
    });

    it("drill-down país → ciudades del país con breadcrumb", async () => {
        const fixture = await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({
            ...QUERY_BASE,
            granularidad: "ciudad",
            paisId: fixture.paisId,
        });

        expect(res.breadcrumb).toEqual([{ nivel: "pais", id: fixture.paisId, etiqueta: "Colombia" }]);
        // El colegio sigue y los padres se conservan por paisCliente = CO.
        expect(res.totales.suscripciones).toBe(3);
    });

    it("paginación estándar sobre las filas agregadas", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().dineroVsValor({
            ...QUERY_BASE,
            granularidad: "padre",
            pageSize: 1,
            page: 2,
        });
        expect(res.pagination).toMatchObject({ page: 2, pageSize: 1, total: 2, totalPages: 2 });
        expect(res.items).toHaveLength(1);
    });
});

describe("AnalisisPanelService.dispersion", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("puntos con cuadrante, sinScore y cortes por mediana", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().dispersion({
            periodo: "mes",
            estado: "todas",
            tipoTitular: "ambos",
        });

        expect(res.puntos).toHaveLength(2);
        expect(res.sinScore).toBe(1);
        expect(res.totalSuscripciones).toBe(3);
        expect(res.cortes.fuente).toBe("mediana");
        // Mediana de [10, 120] = 65; mediana de [80, 90] = 85.
        const porSuscripcion = new Map(res.puntos.map((p) => [p.suscripcionId, p.cuadrante]));
        expect(porSuscripcion.size).toBe(2);
        for (const cuadrante of porSuscripcion.values()) {
            expect(["estables", "riesgo", "oportunidad", "atencion"]).toContain(cuadrante);
        }
    });
});

describe("AnalisisPanelService.topDecisiones", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("máximo 5, prioridad DESC, sin expiradas", async () => {
        const admin = await crearUsuario(RolUsuario.ADMIN, unico("admin") + "@test.co");
        const regla = await prisma.reglaRecomendacion.create({
            data: {
                clave: unico("regla.222.svc"),
                nombre: "Regla",
                descripcion: "Regla",
                categoria: "renovacion",
                sqlQuery: "SELECT 1",
                plantillaRecomendacion: "Título",
                creadaPorAdminId: admin.id,
            },
        });
        for (const prioridad of [10, 90, 50, 70, 30, 60]) {
            await prisma.recomendacion.create({
                data: {
                    reglaId: regla.id,
                    titulo: `Rec ${prioridad}`,
                    descripcion: "Desc",
                    categoria: "renovacion",
                    prioridad,
                    datosContexto: {},
                    expiraEn: new Date(Date.now() + 86_400_000),
                },
            });
        }
        await prisma.recomendacion.create({
            data: {
                reglaId: regla.id,
                titulo: "Expirada",
                descripcion: "Desc",
                categoria: "renovacion",
                prioridad: 100,
                datosContexto: {},
                expiraEn: new Date(Date.now() - 86_400_000),
            },
        });

        const res = await new AnalisisPanelService().topDecisiones();
        expect(res.items).toHaveLength(5);
        expect(res.items.map((i) => i.prioridad)).toEqual([90, 70, 60, 50, 30]);
    });
});

describe("AnalisisPanelService.anomalias", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("orden severidad → fecha y paginación; disponible true con la tabla presente", async () => {
        for (const [severidad, horasAtras] of [
            ["BAJA", 0],
            ["ALTA", 5],
            ["ALTA", 1],
            ["MEDIA", 2],
        ] as const) {
            await prisma.anomalia.create({
                data: {
                    tipo: "USO_CAIDO_ABRUPTO",
                    severidad,
                    descripcion: `Caso ${severidad}`,
                    datosContexto: {},
                    detectadaEn: new Date(Date.now() - horasAtras * 3_600_000),
                },
            });
        }

        const res = await new AnalisisPanelService().anomalias({ severidad: "todas", page: 1, pageSize: 25 });
        expect(res.disponible).toBe(true);
        expect(res.items.map((i) => i.severidad)).toEqual(["ALTA", "ALTA", "MEDIA", "BAJA"]);
        // Entre las dos ALTA, la más reciente primero.
        expect(new Date(res.items[0]!.detectadaEn).getTime()).toBeGreaterThan(
            new Date(res.items[1]!.detectadaEn).getTime()
        );
    });
});

describe("AnalisisPanelService.kpis", () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it("shape de contrato con valores coherentes del fixture", async () => {
        await seedPanel();
        const res = await new AnalisisPanelService().kpis({ periodo: "mes" });

        expect(res.periodo.zona).toBe("America/Bogota");
        // MRR: 3 activas de 120 USD/año → 10 USD/mes cada una.
        expect(res.kpis.mrrUSD.valor).toBe(30);
        // LTV: (120 + 10 + 5) / 3 suscripciones con pagos.
        expect(res.kpis.ltvUSD.valor).toBe(45);
        expect(res.kpis.churnRatePct.valor).toBe(0);
        expect(res.kpis.conversionFreemiumPct.deltaPct).toBeNull();
    });
});
