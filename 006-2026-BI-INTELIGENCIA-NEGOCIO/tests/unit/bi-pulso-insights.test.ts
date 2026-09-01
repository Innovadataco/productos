// tests/unit/bi-pulso-insights.test.ts · Capa de datos del Pulso + motor de insights
// Producto 006 · BI v2 · Fase 3 (Pulso con datos reales de la réplica)
//
// Unitarios puros: '@lib/db' (prisma.$queryRaw) y '@lib/config' (getConfig)
// mockeados — sin BD ni red. Las filas mockeadas tienen la FORMA real del
// ResultSet de cada query (alias snake_case, ::int como number, timestamps
// como Date). El reloj se congela en AHORA para haceMin/días exactos.
//
// Se cubre: cada regla del motor (dispara / no dispara / sin historia),
// getPulso con filas mockeadas (deltas, NULLs honestos candado 9,
// hayDatos=false), ticker con haceMin correcto y texto determinista.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, getConfigMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    getConfigMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("@/lib/config", () => ({ getConfig: getConfigMock }));

import { getPulso } from "@/lib/bi/pulso";
import { getInsights } from "@/lib/bi/insights";

// Reloj congelado: haceMin y días-sin-reportes se asertan exactos.
const AHORA = new Date("2026-09-01T12:00:00.000Z");

// ─── Helpers de mock ─────────────────────────────────────────────────────────

type Filas = Record<string, unknown>[];
type Respuesta = Filas | Error;

/**
 * Despacha por fragmento distintivo del SQL (primer match gana). Un Error en
 * la respuesta simula el fallo de ESA consulta (MV ausente, réplica caída):
 * la sección debe degradar a vacío, nunca reventar el Pulso entero.
 */
function mockConsultas(mapa: Array<[string, Respuesta]>): void {
    queryRawMock.mockImplementation((partes: unknown) => {
        const sql = (Array.isArray(partes) ? partes.join(" ") : String(partes)).replace(/\s+/g, " ");
        for (const [fragmento, respuesta] of mapa) {
            if (sql.includes(fragmento)) {
                return respuesta instanceof Error
                    ? Promise.reject(respuesta)
                    : Promise.resolve(respuesta);
            }
        }
        return Promise.resolve([]);
    });
}

function mockConfig(valores: Record<string, string | null>): void {
    getConfigMock.mockImplementation(async (clave: string) => valores[clave] ?? null);
}

// Fragmentos distintivos de cada query (ver pulso.ts / insights.ts).
const F = {
    agregados: "total_historico",
    colegiosActivos: 'AS total FROM "Colegio"',
    serie: "generate_series",
    categoriasMes: 'ORDER BY total DESC, "categoria"',
    medias: "media_actual_h",
    ticker: 'FROM "TransicionReporte"',
    replica: "pg_stat_subscription",
    ultimo: 'AS ultimo FROM "Reporte"',
    tendencia: "AS reciente",
    colegiosSilenciosos: 'LEFT JOIN "Reporte" r',
} as const;

const SERIE_14_REAL: Array<[string, number]> = [
    ["2026-08-19", 4], ["2026-08-20", 0], ["2026-08-21", 2], ["2026-08-22", 0],
    ["2026-08-23", 1], ["2026-08-24", 0], ["2026-08-25", 3], ["2026-08-26", 0],
    ["2026-08-27", 0], ["2026-08-28", 5], ["2026-08-29", 2], ["2026-08-30", 0],
    ["2026-08-31", 1], ["2026-09-01", 3],
];

function filasSerie(): Filas {
    return SERIE_14_REAL.map(([dia, total]) => ({ dia, total }));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    // Silencia los console.warn deliberados de degradación (no son fallos).
    vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
    vi.useRealTimers();
});

// ─── getPulso ────────────────────────────────────────────────────────────────

describe("getPulso · datos reales mockeados", () => {
    it("arma el Pulso completo: KPIs con delta, serie 14 días, donut, ticker, salud", async () => {
        mockConsultas([
            [F.agregados, [{
                total_historico: 42,
                hoy: 3,
                mes_actual: 12,
                mes_anterior_mismo_tramo: 10,
                reportes_7d: 6,
                reportes_30d: 20,
                clasificados_30d: 18,
            }]],
            [F.colegiosActivos, [{ total: 1 }]],
            [F.medias, [{ media_actual_h: 3.04, media_anterior_h: 3.85 }]],
            [F.serie, filasSerie()],
            [F.categoriasMes, [
                { categoria: "CONTACTO_INSISTENTE", total: 6 },
                { categoria: "OTRO", total: 4 },
                { categoria: "SIN_CLASIFICAR", total: 2 },
            ]],
            [F.ticker, [
                {
                    instante: new Date("2026-09-01T11:57:00.000Z"),
                    estado_nuevo: "CLASIFICADO",
                    reporte_id: "cm123abc456def789XYZ",
                    categoria: "CONTACTO_INSISTENTE",
                },
                {
                    instante: new Date("2026-09-01T11:18:00.000Z"),
                    estado_nuevo: "REVISION_MANUAL",
                    reporte_id: "cm999zzz000111qqqAAA",
                    categoria: null,
                },
            ]],
            [F.replica, [{ total: 1 }]],
            [F.ultimo, [{ ultimo: new Date("2026-09-01T11:48:00.000Z") }]],
        ]);

        const pulso = await getPulso();

        // (12 vs 10) → +20% · medias 3.0/3.9 h → delta −0.9 h (mejora)
        expect(pulso.kpis).toEqual({
            reportesMes: 12,
            deltaMesPct: 20,
            reportesHoy: 3,
            colegiosActivos: 1,
            horasClasificacionMedia: 3,
            deltaClasificacionH: -0.9,
        });
        expect(pulso.serieDiaria).toHaveLength(14);
        expect(pulso.serieDiaria[0]).toEqual({ dia: "2026-08-19", total: 4 });
        expect(pulso.serieDiaria[1]).toEqual({ dia: "2026-08-20", total: 0 }); // hueco a 0
        expect(pulso.serieDiaria[13]).toEqual({ dia: "2026-09-01", total: 3 });
        expect(pulso.porCategoria).toEqual([
            { categoria: "CONTACTO_INSISTENTE", total: 6, pct: 50 },
            { categoria: "OTRO", total: 4, pct: 33 },
            { categoria: "SIN_CLASIFICAR", total: 2, pct: 17 },
        ]);
        // haceMin calculado en servidor (reloj congelado) · texto determinista
        expect(pulso.ticker).toEqual([
            { haceMin: 3, texto: "Reporte #789XYZ clasificado como Contacto insistente" },
            { haceMin: 42, texto: "Reporte #QQQAAA pasó a revisión manual" },
        ]);
        // Salud: 40·min(6/5,1) + 30 (suscripción) + 30·(18/20) = 40+30+27
        expect(pulso.saludOperativa).toBe(97);
        expect(pulso.ultimoReporteHaceMin).toBe(12);
        expect(pulso.hayDatos).toBe(true);
    });

    it("vacío total → hayDatos=false y NULLs honestos, nada inventado", async () => {
        mockConsultas([
            [F.agregados, []], // MV sin filas → fallback de ceros
            [F.medias, [{ media_actual_h: null, media_anterior_h: null }]],
        ]);

        const pulso = await getPulso();

        expect(pulso.hayDatos).toBe(false);
        expect(pulso.kpis).toEqual({
            reportesMes: 0,
            deltaMesPct: null, // sin base → NULL, jamás % inventado
            reportesHoy: 0,
            colegiosActivos: 0,
            horasClasificacionMedia: null,
            deltaClasificacionH: null,
        });
        expect(pulso.serieDiaria).toEqual([]);
        expect(pulso.porCategoria).toEqual([]);
        expect(pulso.ticker).toEqual([]);
        expect(pulso.saludOperativa).toBe(0);
        expect(pulso.ultimoReporteHaceMin).toBeNull();
    });

    it("mes sin tramo anterior → deltaMesPct NULL (no '100%' inventado) y salud 100 real", async () => {
        mockConsultas([
            [F.agregados, [{
                total_historico: 5,
                hoy: 2,
                mes_actual: 5,
                mes_anterior_mismo_tramo: 0,
                reportes_7d: 5,
                reportes_30d: 5,
                clasificados_30d: 5,
            }]],
            [F.medias, [{ media_actual_h: 2.5, media_anterior_h: null }]],
            [F.replica, [{ total: 1 }]],
        ]);

        const pulso = await getPulso();

        expect(pulso.hayDatos).toBe(true);
        expect(pulso.kpis.deltaMesPct).toBeNull(); // candado 9
        expect(pulso.kpis.horasClasificacionMedia).toBe(2.5);
        expect(pulso.kpis.deltaClasificacionH).toBeNull(); // sin historia anterior
        // 40·min(5/5,1) + 30 + 30·(5/5) = 100
        expect(pulso.saludOperativa).toBe(100);
    });

    it("sin suscripción de réplica → la salud pierde los 30 pts de réplica", async () => {
        mockConsultas([
            [F.agregados, [{
                total_historico: 42,
                hoy: 3,
                mes_actual: 12,
                mes_anterior_mismo_tramo: 10,
                reportes_7d: 6,
                reportes_30d: 20,
                clasificados_30d: 18,
            }]],
            [F.replica, [{ total: 0 }]],
        ]);

        const pulso = await getPulso();

        // 40 (actividad plena) + 0 (réplica) + 27 (clasificación) = 67
        expect(pulso.saludOperativa).toBe(67);
    });

    it("ticker: tope de 8 en servidor y haceMin por piso de minuto", async () => {
        const diez = Array.from({ length: 10 }, (_, i) => ({
            instante: new Date("2026-09-01T11:58:30.000Z"), // 90 s → 1 min (floor)
            estado_nuevo: "CLASIFICADO",
            reporte_id: `cm-reporte-${String(i).padStart(3, "0")}abcdef`,
            categoria: "OTRO",
        }));
        mockConsultas([[F.ticker, diez]]);

        const pulso = await getPulso();

        expect(pulso.ticker).toHaveLength(8);
        expect(pulso.ticker[0].haceMin).toBe(1);
        expect(pulso.ticker[0].texto).toBe("Reporte #ABCDEF clasificado como Otro");
    });

    it("una consulta rota degrada su sección a vacío sin reventar el Pulso", async () => {
        mockConsultas([
            [F.agregados, new Error("relation mv_fact_reporte_diario does not exist")],
            [F.ticker, [{
                instante: new Date("2026-09-01T11:59:00.000Z"),
                estado_nuevo: "POSIBLE_SPAM",
                reporte_id: "cm-degradado-0000ff",
                categoria: null,
            }]],
            [F.replica, [{ total: 1 }]],
        ]);

        const pulso = await getPulso();

        expect(pulso.hayDatos).toBe(false); // agregados en cero por degradación
        expect(pulso.kpis.reportesMes).toBe(0);
        expect(pulso.ticker).toEqual([
            { haceMin: 1, texto: "Reporte #0000FF marcado como posible spam" },
        ]);
        expect(pulso.saludOperativa).toBe(30); // solo réplica aporta
    });
});

// ─── getInsights ─────────────────────────────────────────────────────────────

describe("getInsights · regla (a) tendencia → ambar", () => {
    it("dispara: categoría supera el umbral de subida (8 vs 4 → +100% ≥ 50)", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "50", "bi.insights.dias_sin_reportes": "30" });
        mockConsultas([
            [F.tendencia, [
                { categoria: "CIBERACOSO", reciente: 8, previa: 4 },
                { categoria: "OTRO", reciente: 1, previa: 1 },
            ]],
        ]);

        const insights = await getInsights();

        expect(insights).toEqual([
            {
                severidad: "ambar",
                titulo: "Ciberacoso sube 100% en 2 semanas",
                detalle: "De 4 a 8 reportes: últimas 2 semanas vs. las 2 anteriores. Umbral de alerta: 50%.",
                accion: { etiqueta: "Ver operación →", href: "/operacion" },
            },
        ]);
    });

    it("no dispara bajo el umbral (5 vs 4 → +25% < 50)", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "50", "bi.insights.dias_sin_reportes": "30" });
        mockConsultas([[F.tendencia, [{ categoria: "OTRO", reciente: 5, previa: 4 }]]]);

        expect(await getInsights()).toEqual([]);
    });

    it("no dispara sin base (previa = 0): no hay % computable (candado 9)", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "50", "bi.insights.dias_sin_reportes": "30" });
        mockConsultas([[F.tendencia, [{ categoria: "DOXING", reciente: 9, previa: 0 }]]]);

        expect(await getInsights()).toEqual([]);
    });

    it("honra el umbral de bi_config (20 → +25% sí dispara)", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "20", "bi.insights.dias_sin_reportes": "30" });
        mockConsultas([[F.tendencia, [{ categoria: "OTRO", reciente: 5, previa: 4 }]]]);

        const insights = await getInsights();

        expect(insights).toHaveLength(1);
        expect(insights[0].titulo).toBe("Otro sube 25% en 2 semanas");
        expect(insights[0].detalle).toContain("Umbral de alerta: 20%.");
    });

    it("umbral roto en bi_config → default 50", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "no-es-numero" });
        mockConsultas([[F.tendencia, [{ categoria: "OTRO", reciente: 5, previa: 4 }]]]);

        expect(await getInsights()).toEqual([]);
    });
});

describe("getInsights · regla (b) colegios sin reportes → cielo", () => {
    const COLEGIOS = [
        { colegio_id: "c1", nombre: "Col. Bellavista", ultimo: new Date("2026-07-20T00:00:00.000Z") }, // 43 días
        { colegio_id: "c2", nombre: "Col. Nuevo Amanecer", ultimo: null }, // jamás reportó
        { colegio_id: "c3", nombre: "I.E. San José", ultimo: new Date("2026-08-30T12:00:00.000Z") }, // 2 días
    ];

    it("dispara: 2 de 3 colegios llevan 30+ días (o jamás) sin reportes", async () => {
        mockConfig({ "bi.insights.dias_sin_reportes": "30", "bi.insights.subida_semanal_pct": "50" });
        mockConsultas([[F.colegiosSilenciosos, COLEGIOS]]);

        const insights = await getInsights();

        expect(insights).toEqual([
            {
                severidad: "cielo",
                titulo: "2 colegios sin reportes en 30+ días",
                detalle: "Col. Bellavista, Col. Nuevo Amanecer. Puede indicar subregistro, no necesariamente ausencia de riesgo.",
                accion: { etiqueta: "Ver operación →", href: "/operacion" },
            },
        ]);
    });

    it("singular: con umbral 45 solo queda el colegio que jamás reportó", async () => {
        mockConfig({ "bi.insights.dias_sin_reportes": "45", "bi.insights.subida_semanal_pct": "50" });
        mockConsultas([[F.colegiosSilenciosos, COLEGIOS]]);

        const insights = await getInsights();

        expect(insights).toHaveLength(1);
        expect(insights[0].titulo).toBe("1 colegio sin reportes en 45+ días");
        expect(insights[0].detalle).toContain("Col. Nuevo Amanecer");
    });

    it("no dispara cuando todos reportaron hace poco", async () => {
        mockConfig({ "bi.insights.dias_sin_reportes": "30", "bi.insights.subida_semanal_pct": "50" });
        mockConsultas([
            [F.colegiosSilenciosos, [
                { colegio_id: "c3", nombre: "I.E. San José", ultimo: new Date("2026-08-30T12:00:00.000Z") },
            ]],
        ]);

        expect(await getInsights()).toEqual([]);
    });
});

describe("getInsights · regla (c) mejora de clasificación → pino", () => {
    it("dispara: la media bajó (3.3 h → 2.5 h)", async () => {
        mockConfig({ "bi.insights.dias_sin_reportes": "30", "bi.insights.subida_semanal_pct": "50" });
        mockConsultas([[F.medias, [{ media_actual_h: 2.5, media_anterior_h: 3.3 }]]]);

        const insights = await getInsights();

        expect(insights).toEqual([
            {
                severidad: "pino",
                titulo: "Clasificación 0.8 h más rápida",
                detalle: "La media bajó de 3.3 h a 2.5 h (últimos 30 días vs. los 30 anteriores). El circuito de revisión está funcionando.",
                accion: { etiqueta: "Preguntar al chat", href: "/chat" },
            },
        ]);
    });

    it("no dispara si la media empeoró", async () => {
        mockConfig({ "bi.insights.dias_sin_reportes": "30", "bi.insights.subida_semanal_pct": "50" });
        mockConsultas([[F.medias, [{ media_actual_h: 3.9, media_anterior_h: 3.3 }]]]);

        expect(await getInsights()).toEqual([]);
    });

    it("no dispara sin historia en la ventana anterior (NULL honesto)", async () => {
        mockConfig({ "bi.insights.dias_sin_reportes": "30", "bi.insights.subida_semanal_pct": "50" });
        mockConsultas([[F.medias, [{ media_actual_h: 2.5, media_anterior_h: null }]]]);

        expect(await getInsights()).toEqual([]);
    });
});

describe("getInsights · conjunto", () => {
    it("sin historia suficiente → [] (jamás insights fabricados)", async () => {
        mockConfig({});
        mockConsultas([]); // todas las consultas devuelven []

        expect(await getInsights()).toEqual([]);
    });

    it("los 3 disparan → máximo 3, ordenados ambar → cielo → pino", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "50", "bi.insights.dias_sin_reportes": "30" });
        mockConsultas([
            [F.tendencia, [{ categoria: "CIBERACOSO", reciente: 8, previa: 4 }]],
            [F.colegiosSilenciosos, [
                { colegio_id: "c2", nombre: "Col. Nuevo Amanecer", ultimo: null },
            ]],
            [F.medias, [{ media_actual_h: 2.5, media_anterior_h: 3.3 }]],
        ]);

        const insights = await getInsights();

        expect(insights.map((i) => i.severidad)).toEqual(["ambar", "cielo", "pino"]);
        expect(insights).toHaveLength(3);
    });

    it("una regla rota no tumbó a las demás: pino sobrevive sin ambar", async () => {
        mockConfig({ "bi.insights.subida_semanal_pct": "50", "bi.insights.dias_sin_reportes": "30" });
        mockConsultas([
            [F.tendencia, new Error("relation mv_fact_reporte_diario does not exist")],
            [F.medias, [{ media_actual_h: 2.5, media_anterior_h: 3.3 }]],
        ]);

        const insights = await getInsights();

        expect(insights.map((i) => i.severidad)).toEqual(["pino"]);
    });
});
