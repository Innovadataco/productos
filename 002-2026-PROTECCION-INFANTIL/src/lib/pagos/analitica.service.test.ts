/**
 * SPEC-218 (002-PI-118): tests unitarios del servicio de analítica
 * dinero-vs-valor. Sin BD: el repositorio se sustituye por un doble hecho a
 * mano (no es un mock de Prisma; el servicio depende de la interfaz
 * estructural `AnaliticaRepositorio`). El reloj se inyecta para evitar drift.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { EstadoSuscripcion, TipoTitular } from "@prisma/client";
import {
    AnaliticaPagosService,
    invalidarCacheAnalitica,
    type AnaliticaRepositorio,
    type KpiBase,
} from "./analitica.service";

const AHORA = new Date("2026-08-24T15:00:00.000Z"); // lunes 24-ago-2026 10:00 Bogotá

function kpiBaseVacio(): KpiBase {
    return {
        recaudoMesActualUSD: 0,
        recaudoMesAnteriorUSD: 0,
        conteoPorEstado: [],
        nuevasEsteMes: 0,
        renovacionesEsteMes: 0,
        ticketPromedioMesUSD: null,
        recaudoTotalUSD: 0,
        suscripcionesPagantes: 0,
        freemiumTotal: 0,
        freemiumConvertidas: 0,
        conCodigoReferido: 0,
        totalSuscripciones: 0,
    };
}

function repoFake(overrides: Partial<AnaliticaRepositorio> = {}): AnaliticaRepositorio & { llamadas: Record<string, number> } {
    const llamadas: Record<string, number> = {};
    const contar = (clave: string) => {
        llamadas[clave] = (llamadas[clave] ?? 0) + 1;
    };
    return {
        llamadas,
        listarSuscripcionesVencenEntre: async () => {
            contar("vencimientos");
            return [];
        },
        listarMoraLargaAntesDe: async () => {
            contar("mora");
            return [];
        },
        listarPadresPagantesColegiosNoRenovados: async () => {
            contar("padres");
            return [];
        },
        listarAltasPorPaisDesde: async () => {
            contar("altas");
            return [];
        },
        obtenerKpiAnalitica: async () => {
            contar("kpi");
            return kpiBaseVacio();
        },
        ...overrides,
    };
}

function servicio(repo: AnaliticaRepositorio, opciones: { cacheSegundos?: number } = {}) {
    return new AnaliticaPagosService(repo, { ahora: () => AHORA, ...opciones });
}

beforeEach(() => {
    invalidarCacheAnalitica();
});

describe("obtenerKpi", () => {
    it("deriva variaciones, conteos por estado y porcentajes", async () => {
        const repo = repoFake({
            obtenerKpiAnalitica: async (rangos) => {
                // Agosto Bogotá: [2026-08-01T05:00Z, 2026-09-01T05:00Z).
                expect(rangos.mesActual.inicio.toISOString()).toBe("2026-08-01T05:00:00.000Z");
                expect(rangos.mesAnterior.inicio.toISOString()).toBe("2026-07-01T05:00:00.000Z");
                return {
                    ...kpiBaseVacio(),
                    recaudoMesActualUSD: 1500,
                    recaudoMesAnteriorUSD: 1200,
                    conteoPorEstado: [
                        { estado: EstadoSuscripcion.ACTIVA, total: 45 },
                        { estado: EstadoSuscripcion.EN_GRACIA, total: 5 },
                        { estado: EstadoSuscripcion.SUSPENDIDA, total: 3 },
                        { estado: EstadoSuscripcion.CANCELADA, total: 2 },
                    ],
                    nuevasEsteMes: 8,
                    renovacionesEsteMes: 12,
                    ticketPromedioMesUSD: 75,
                    recaudoTotalUSD: 13500,
                    suscripcionesPagantes: 60,
                    freemiumTotal: 10,
                    freemiumConvertidas: 6,
                    conCodigoReferido: 11,
                    totalSuscripciones: 55,
                };
            },
        });

        const kpi = await servicio(repo).obtenerKpi();
        expect(kpi.variacionRecaudoPct).toBe(25);
        expect(kpi.activas).toBe(45);
        expect(kpi.enGracia).toBe(5);
        expect(kpi.suspendidas).toBe(3);
        expect(kpi.canceladas).toBe(2);
        expect(kpi.nuevasEsteMes).toBe(8);
        expect(kpi.renovacionesEsteMes).toBe(12);
        expect(kpi.ticketPromedioUSD).toBe(75);
        expect(kpi.ltvUSD).toBe(225);
        expect(kpi.conversionFreemiumPct).toBe(60);
        expect(kpi.tasaReferidosPct).toBe(20);
    });

    it("devuelve nulls defensivos sin datos", async () => {
        const kpi = await servicio(repoFake()).obtenerKpi();
        expect(kpi.variacionRecaudoPct).toBe(0);
        expect(kpi.ticketPromedioUSD).toBeNull();
        expect(kpi.ltvUSD).toBeNull();
        expect(kpi.conversionFreemiumPct).toBeNull();
        expect(kpi.tasaReferidosPct).toBeNull();
    });
});

describe("obtenerVencimientosEstaSemana", () => {
    it("consulta la ventana hoy → hoy+7 y mapea días restantes", async () => {
        const repo = repoFake({
            listarSuscripcionesVencenEntre: async (desde, hasta) => {
                expect(desde.toISOString()).toBe(AHORA.toISOString());
                expect(hasta.getTime() - desde.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
                return [
                    {
                        id: "sub-1",
                        tipoTitular: TipoTitular.COLEGIO,
                        estado: EstadoSuscripcion.ACTIVA,
                        fechaFin: new Date("2026-08-29T15:00:00.000Z"),
                        colegio: { id: "col-1", nombre: "Colegio Andino" },
                        usuario: null,
                    },
                    {
                        id: "sub-2",
                        tipoTitular: TipoTitular.PADRE,
                        estado: EstadoSuscripcion.ACTIVA,
                        fechaFin: new Date("2026-08-25T15:00:00.000Z"),
                        colegio: null,
                        usuario: { id: "usr-1", nombre: null, email: "padre@test.co" },
                    },
                ];
            },
        });

        const widget = await servicio(repo).obtenerVencimientosEstaSemana();
        expect(widget.total).toBe(2);
        expect(widget.items[0]).toMatchObject({
            suscripcionId: "sub-1",
            nombre: "Colegio Andino",
            rol: TipoTitular.COLEGIO,
            email: null,
            fechaFin: "2026-08-29",
            diasRestantes: 5,
        });
        // Padre sin nombre: se muestra el email como nombre y como contacto.
        expect(widget.items[1]).toMatchObject({ nombre: "padre@test.co", email: "padre@test.co", diasRestantes: 1 });
    });
});

describe("obtenerMoraLarga", () => {
    it("consulta con fechaFin límite de hace 30 días y calcula días de mora", async () => {
        const repo = repoFake({
            listarMoraLargaAntesDe: async (limite) => {
                expect(AHORA.getTime() - limite.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
                return [
                    {
                        id: "sub-9",
                        tipoTitular: TipoTitular.PADRE,
                        estado: EstadoSuscripcion.SUSPENDIDA,
                        fechaFin: new Date("2026-07-20T15:00:00.000Z"),
                        colegio: null,
                        usuario: { id: "usr-9", nombre: "Padre López", email: "lopez@test.co" },
                    },
                ];
            },
        });

        const widget = await servicio(repo).obtenerMoraLarga();
        expect(widget.total).toBe(1);
        expect(widget.items[0]).toMatchObject({
            suscripcionId: "sub-9",
            nombre: "Padre López",
            diasMora: 35,
            estado: EstadoSuscripcion.SUSPENDIDA,
        });
    });
});

describe("obtenerPadresPagantesColegiosCaidos", () => {
    it("mapea padre, colegio caído y contacto del rector", async () => {
        const repo = repoFake({
            listarPadresPagantesColegiosNoRenovados: async () => [
                {
                    id: "sub-p1",
                    usuario: {
                        id: "usr-p1",
                        nombre: "Ana R.",
                        email: "ana@test.co",
                        tenant: {
                            colegio: {
                                id: "col-b",
                                nombre: "Colegio Beta",
                                representanteLegalNombre: "Rector Beta",
                                representanteLegalEmail: "rector@beta.edu",
                                suscripciones: [{ estado: EstadoSuscripcion.SUSPENDIDA }],
                            },
                        },
                    },
                },
                // Registro sin colegio resoluble: se descarta de forma defensiva.
                { id: "sub-p2", usuario: null },
            ],
        });

        const widget = await servicio(repo).obtenerPadresPagantesColegiosCaidos();
        expect(widget.total).toBe(1);
        expect(widget.items[0]).toEqual({
            padreId: "usr-p1",
            padreNombre: "Ana R.",
            colegioId: "col-b",
            colegioNombre: "Colegio Beta",
            colegioEstado: EstadoSuscripcion.SUSPENDIDA,
            rectorNombre: "Rector Beta",
            rectorEmail: "rector@beta.edu",
        });
    });
});

describe("obtenerCrecimientoPaisCiudad", () => {
    it("devuelve 6 etiquetas de mes y series con alerta", async () => {
        const repo = repoFake({
            listarAltasPorPaisDesde: async (desde) => {
                expect(desde.toISOString()).toBe("2026-03-01T05:00:00.000Z");
                return [
                    ...Array.from({ length: 10 }, () => ({
                        paisCliente: "CO",
                        createdAt: new Date("2026-07-15T12:00:00.000Z"),
                    })),
                    ...Array.from({ length: 18 }, () => ({
                        paisCliente: "CO",
                        createdAt: new Date("2026-08-15T12:00:00.000Z"),
                    })),
                ];
            },
        });

        const widget = await servicio(repo).obtenerCrecimientoPaisCiudad();
        expect(widget.labels).toEqual(["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"]);
        expect(widget.series).toHaveLength(1);
        expect(widget.series[0]).toMatchObject({ pais: "CO", variacionPct: 80, alerta: "crecimiento_alto" });
        expect(widget.series[0].data).toEqual([0, 0, 0, 0, 10, 18]);
    });
});

describe("caché por widget (FR-006)", () => {
    it("sirve el segundo llamado desde caché dentro del TTL", async () => {
        const repo = repoFake();
        const svc = servicio(repo, { cacheSegundos: 60 });
        await svc.obtenerKpi();
        await svc.obtenerKpi();
        expect(repo.llamadas["kpi"]).toBe(1);
    });

    it("la caché es por widget: cada widget consulta su propia query", async () => {
        const repo = repoFake();
        const svc = servicio(repo, { cacheSegundos: 60 });
        await svc.obtenerAnalitica();
        expect(repo.llamadas["kpi"]).toBe(1);
        expect(repo.llamadas["vencimientos"]).toBe(1);
        expect(repo.llamadas["mora"]).toBe(1);
        expect(repo.llamadas["padres"]).toBe(1);
        expect(repo.llamadas["altas"]).toBe(1);
    });

    it("expira pasado el TTL", async () => {
        const repo = repoFake();
        let reloj = AHORA.getTime();
        const svc = new AnaliticaPagosService(repo, { ahora: () => new Date(reloj), cacheSegundos: 60 });
        await svc.obtenerKpi();
        reloj += 61 * 1000;
        await svc.obtenerKpi();
        expect(repo.llamadas["kpi"]).toBe(2);
    });

    it("invalidarCacheAnalitica fuerza re-consulta", async () => {
        const repo = repoFake();
        const svc = servicio(repo, { cacheSegundos: 60 });
        await svc.obtenerKpi();
        invalidarCacheAnalitica();
        await svc.obtenerKpi();
        expect(repo.llamadas["kpi"]).toBe(2);
    });
});
