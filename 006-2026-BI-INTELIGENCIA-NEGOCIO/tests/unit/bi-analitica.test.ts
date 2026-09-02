// tests/unit/bi-analitica.test.ts · Capa de datos de Analítica (SPEC-006)
// Producto 006 · BI v2 · pantalla Analítica (mockup-bi-v4.html)
//
// Unitarios puros: '@/lib/db' (prisma.$queryRaw) y '@/lib/config' (getConfig)
// mockeados — sin BD ni red. Las filas mockeadas tienen la FORMA real del
// ResultSet de cada query (alias snake_case, ::int como number, ::float como
// number, timestamps como Date). El reloj se congela en AHORA (mediados de
// mes: las aserciones de mes no dependen de la TZ del runner).
//
// Se cubre: cada regla (dispara / no dispara / sin base), z-score correcto,
// proyección NULL sin base y exacta con tendencia lineal, severidades,
// dedupe/orden/tope de fenómenos, ventanas de vencimientos, cronología con
// marcadores, defaults B3 con config inválida y degradación por sección.
// SPEC-006 (mejoras en vivo): getProyeccion con horizonte 4/8/12 (rangos
// distintos, NULL sin base), getDetalleMes (mes con datos / sin datos →
// null / formato inválido → null, fenómenos ráfaga + pico σ) y las rutas
// GET detalle-mes / proyeccion (401 sin sesión, 400 formato/horizonte, 200
// con datos, 404 sin_datos).

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, getConfigMock, leerSesionMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    getConfigMock: vi.fn(),
    leerSesionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("@/lib/config", () => ({ getConfig: getConfigMock }));
vi.mock("@/lib/auth/sesion", () => ({ leerSesion: leerSesionMock }));

import { getAnalitica, getDetalleMes, getProyeccion } from "@/lib/bi/analitica";
import { GET as GET_DETALLE_MES } from "@/app/api/bi/analitica/detalle-mes/route";
import { GET as GET_PROYECCION } from "@/app/api/bi/analitica/proyeccion/route";

// Medidos de septiembre: claveMes() es estable en cualquier TZ razonable.
const AHORA = new Date("2026-09-15T12:00:00.000Z");
const MES_ACTUAL = "2026-09";
const HACE_UN_ANIO = new Date("2022-01-01T00:00:00.000Z");
const HACE_5_DIAS = new Date("2026-09-10T00:00:00.000Z");

// ─── Helpers de mock (mismo patrón que bi-pulso-insights.test.ts) ────────────

type Filas = Record<string, unknown>[];
type Respuesta = Filas | Error;

/**
 * Despacha por fragmento distintivo del SQL (primer match gana). Un Error en
 * la respuesta simula el fallo de ESA consulta: la sección debe degradar a
 * vacío, nunca reventar Analítica entera.
 */
function mockConsultas(mapa: Array<[string, Respuesta]>): void {
    queryRawMock.mockImplementation((partes: unknown) => {
        const sql = (Array.isArray(partes) ? partes.join(" ") : String(partes)).replace(
            /\s+/g,
            " ",
        );
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

// Fragmentos distintivos de cada query de analitica.ts.
const F = {
    anomaliaBase: "media_28d",
    anomaliaHoy: "primer_reporte",
    semanas: "YYYY-MM-DD",
    riesgo: "interval '12 months'",
    plataforma: "reciente_14d",
    rafaga: 'AS total FROM "Reporte" WHERE "eliminado" = false AND "esRafaga"',
    rafagaPlataforma: 'AS plataforma, count(*)',
    geo: "semanas_con_datos",
    frenteReportes: "reportes_padres",
    frenteComercial: "suscripciones_padre",
    vencimientos: "esta_semana",
    cronologia: "interval '11 months'",
} as const;

// Fragmentos distintivos de las 5 queries de getDetalleMes.
const FD = {
    totales: '"esAnonimo"',
    categoria: "LIMIT 1",
    alertas: 'FROM "AlertaColegio"',
    rafaga: '"esRafaga"',
    anio: "date_trunc('year'",
} as const;

const EMAIL_SESION = "jelkin@innovadataco.com";

const SENSIBLES_PI =
    "SOLICITUD_MATERIAL,COMPARTIMIENTO_SEXUAL,DIFUSION_NO_CONSENTIDA,SOLICITUD_ENCUENTRO,EXTORSION";

/** Config estándar: sensibles reales de PI, umbrales ausentes → defaults B3. */
function mockConfigEstandar(): void {
    mockConfig({ "operacion.categorias_sensibles": SENSIBLES_PI });
}

/** 8 semanas con los totales dados (etiquetas YYYY-MM-DD cualesquiera). */
function filasSemanas(totales: number[]): Filas {
    return totales.map((total, i) => ({
        semana: `2026-07-${String(13 + i * 7).padStart(2, "0")}`,
        total,
    }));
}

/** 12 meses móviles terminando en MES_ACTUAL (totales dados o 0). */
function filasCronologia(totales?: number[]): Filas {
    const meses: string[] = [];
    const cursor = new Date("2025-10-01T00:00:00.000Z");
    for (let i = 0; i < 12; i++) {
        meses.push(
            `${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`,
        );
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
    return meses.map((mes, i) => ({ mes, total: totales?.[i] ?? 0 }));
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    // Silencia los console.warn deliberados de degradación (no son fallos).
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockConfigEstandar();
    // Sesión válida por defecto para los tests de rutas (SE2).
    leerSesionMock.mockResolvedValue({ email: EMAIL_SESION });
});

afterEach(() => {
    vi.useRealTimers();
});

// ─── (a) anomaliaHoy ─────────────────────────────────────────────────────────

describe("anomaliaHoy · z-score del día contra 28 días", () => {
    it("calcula sigma correcto y declara anomalía al superar el umbral default (2σ)", async () => {
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 10, desvio_28d: 2 }]],
            [F.anomaliaHoy, [{ hoy: 15, primer_reporte: HACE_UN_ANIO }]],
        ]);
        const data = await getAnalitica();
        // z = (15 − 10) / 2 = 2.5 ≥ 2 → anómalo.
        expect(data.anomaliaHoy).toEqual({
            sigma: 2.5,
            totalHoy: 15,
            media28d: 10,
            esAnomalo: true,
        });
    });

    it("no dispara con sigma bajo el umbral", async () => {
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 10, desvio_28d: 2 }]],
            [F.anomaliaHoy, [{ hoy: 11, primer_reporte: HACE_UN_ANIO }]],
        ]);
        const data = await getAnalitica();
        expect(data.anomaliaHoy.sigma).toBe(0.5);
        expect(data.anomaliaHoy.esAnomalo).toBe(false);
    });

    it("respeta el umbral sigma de bi_config cuando existe", async () => {
        mockConfig({
            "operacion.categorias_sensibles": SENSIBLES_PI,
            "bi.analitica.sigma": "3",
        });
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 10, desvio_28d: 2 }]],
            [F.anomaliaHoy, [{ hoy: 15, primer_reporte: HACE_UN_ANIO }]],
        ]);
        const data = await getAnalitica();
        // 2.5 < 3 → no anómalo con el umbral del operador.
        expect(data.anomaliaHoy.sigma).toBe(2.5);
        expect(data.anomaliaHoy.esAnomalo).toBe(false);
    });

    it("NULL honesto si el histórico no alcanza 28 días de base", async () => {
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 4, desvio_28d: 1.5 }]],
            [F.anomaliaHoy, [{ hoy: 6, primer_reporte: HACE_5_DIAS }]],
        ]);
        const data = await getAnalitica();
        expect(data.anomaliaHoy).toEqual({
            sigma: null,
            totalHoy: 6,
            media28d: null,
            esAnomalo: false,
        });
    });

    it("NULL honesto sin ningún reporte histórico", async () => {
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 0, desvio_28d: 0 }]],
            [F.anomaliaHoy, [{ hoy: 0, primer_reporte: null }]],
        ]);
        const data = await getAnalitica();
        expect(data.anomaliaHoy.sigma).toBeNull();
        expect(data.anomaliaHoy.media28d).toBeNull();
        expect(data.anomaliaHoy.totalHoy).toBe(0);
        expect(data.anomaliaHoy.esAnomalo).toBe(false);
    });

    it("desvío 0 (sin dispersión) → sigma NULL aunque haya base y media", async () => {
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 5, desvio_28d: 0 }]],
            [F.anomaliaHoy, [{ hoy: 9, primer_reporte: HACE_UN_ANIO }]],
        ]);
        const data = await getAnalitica();
        expect(data.anomaliaHoy.sigma).toBeNull();
        expect(data.anomaliaHoy.media28d).toBe(5);
        expect(data.anomaliaHoy.esAnomalo).toBe(false);
    });
});

// ─── (b) proyeccion ──────────────────────────────────────────────────────────

describe("proyeccion · tendencia 8 semanas + rango", () => {
    it("tendencia lineal exacta proyecta el punto siguiente sin residuo", async () => {
        // y = 10 + 2x (x=0..7) → ŷ₈ = 26, desvío residual 0 → min = max = 26.
        mockConsultas([
            [F.semanas, filasSemanas([10, 12, 14, 16, 18, 20, 22, 24])],
        ]);
        const data = await getAnalitica();
        expect(data.proyeccion.hayBase).toBe(true);
        expect(data.proyeccion.semanaProximaMin).toBe(26);
        expect(data.proyeccion.semanaProximaMax).toBe(26);
        expect(data.proyeccion.tendenciaSemanas).toHaveLength(8);
    });

    it("el rango se abre con el desvío de residuos y pisa en 0", async () => {
        // y constante 10 → ŷ₈ = 10, residuos 0 → [10, 10].
        mockConsultas([[F.semanas, filasSemanas([10, 10, 10, 10, 10, 10, 10, 10])]]);
        const data = await getAnalitica();
        expect(data.proyeccion.semanaProximaMin).toBe(10);
        expect(data.proyeccion.semanaProximaMax).toBe(10);
    });

    it("min/max NULL si hay menos de 4 semanas con actividad (poca base)", async () => {
        mockConsultas([[F.semanas, filasSemanas([0, 0, 0, 0, 0, 0, 1, 2])]]);
        const data = await getAnalitica();
        expect(data.proyeccion.hayBase).toBe(false);
        expect(data.proyeccion.semanaProximaMin).toBeNull();
        expect(data.proyeccion.semanaProximaMax).toBeNull();
        // La serie igual se expone con sus 0 reales (vacío honesto).
        expect(data.proyeccion.tendenciaSemanas.map((s) => s.total)).toEqual([
            0, 0, 0, 0, 0, 0, 1, 2,
        ]);
    });

    it("sin filas de tendencia (sondeo degradado) → hayBase false y serie vacía", async () => {
        mockConsultas([[F.semanas, new Error("réplica caída")]]);
        const data = await getAnalitica();
        expect(data.proyeccion.hayBase).toBe(false);
        expect(data.proyeccion.semanaProximaMin).toBeNull();
        expect(data.proyeccion.tendenciaSemanas).toEqual([]);
    });
});

// ─── (c) riesgoCategorias ────────────────────────────────────────────────────

describe("riesgoCategorias · frecuencia 12 m × sensibilidad", () => {
    const FILAS = [
        { categoria: "SOLICITUD_MATERIAL", total: 155 },
        { categoria: "CIBERACOSO", total: 108 },
        { categoria: "EXTORSION", total: 30 },
        { categoria: "OFRECIMIENTO_REGALOS", total: 20 },
        { categoria: "CONTACTO_INSISTENTE", total: 10 },
        { categoria: "DOXING", total: 5 },
    ];

    it("asigna severidades según el criterio documentado", async () => {
        mockConsultas([[F.riesgo, FILAS]]);
        const data = await getAnalitica();
        expect(data.riesgoCategorias).toEqual([
            // sensible y ≥ 50 → crítica
            { categoria: "SOLICITUD_MATERIAL", total: 155, severidad: "critica" },
            // no sensible más frecuente → alta
            { categoria: "CIBERACOSO", total: 108, severidad: "alta" },
            // sensible bajo el mínimo → alta
            { categoria: "EXTORSION", total: 30, severidad: "alta" },
            // no sensible dentro del top 5 → vigilar
            { categoria: "OFRECIMIENTO_REGALOS", total: 20, severidad: "vigilar" },
            { categoria: "CONTACTO_INSISTENTE", total: 10, severidad: "vigilar" },
            // fuera del top 5 → baja
            { categoria: "DOXING", total: 5, severidad: "baja" },
        ]);
    });

    it("el mínimo de riesgo configurable baja sensibles a 'alta'", async () => {
        mockConfig({
            "operacion.categorias_sensibles": SENSIBLES_PI,
            "bi.analitica.riesgo_minimo": "200",
        });
        mockConsultas([[F.riesgo, FILAS]]);
        const data = await getAnalitica();
        expect(data.riesgoCategorias[0].severidad).toBe("alta"); // 155 < 200
        expect(data.riesgoCategorias[2].severidad).toBe("alta");
    });

    it("sin lista de sensibles nadie es 'critica' (deny-by-default)", async () => {
        mockConfig({});
        mockConsultas([[F.riesgo, FILAS]]);
        const data = await getAnalitica();
        expect(
            data.riesgoCategorias.every((c) => c.severidad !== "critica"),
        ).toBe(true);
        expect(data.riesgoCategorias[0].severidad).toBe("alta"); // top no sensible
    });

    it("vacío honesto: sin clasificaciones → []", async () => {
        mockConsultas([[F.riesgo, []]]);
        const data = await getAnalitica();
        expect(data.riesgoCategorias).toEqual([]);
    });
});

// ─── (d) fenomenos ───────────────────────────────────────────────────────────

describe("fenomenos · detector (plataforma / ráfaga / geo)", () => {
    it("plataforma×categoría dispara al duplicar la quincena previa con base mínima", async () => {
        mockConsultas([
            [
                F.plataforma,
                [{ plataforma: "Roblox", categoria: "CIBERACOSO", reciente_14d: 12, previa_14d: 6 }],
            ],
        ]);
        const data = await getAnalitica();
        expect(data.fenomenos).toHaveLength(1);
        expect(data.fenomenos[0]).toMatchObject({
            tipo: "plataforma",
            titulo: "Roblox × Ciberacoso: +100% en 14 días",
            evidencia: "De 3 a 6 reportes semanales (14 días vs. 14 previos)",
            sev: "alta",
        });
    });

    it("plataforma no dispara con subida insuficiente o sin base (previa 0)", async () => {
        mockConsultas([
            [
                F.plataforma,
                [
                    // +33% < 100% → fuera
                    { plataforma: "Roblox", categoria: "CIBERACOSO", reciente_14d: 8, previa_14d: 6 },
                    // previa 0 → sin base de comparación honesta
                    { plataforma: "Telegram", categoria: "OTRO", reciente_14d: 10, previa_14d: 0 },
                ],
            ],
        ]);
        const data = await getAnalitica();
        expect(data.fenomenos).toEqual([]);
    });

    it("deduplica por plataforma quedándose con el cruce más fuerte", async () => {
        mockConsultas([
            [
                F.plataforma,
                [
                    // El SQL ordena por reciente DESC; el lib reordena por factor.
                    { plataforma: "Roblox", categoria: "CIBERACOSO", reciente_14d: 20, previa_14d: 5 },
                    { plataforma: "Roblox", categoria: "EXTORSION", reciente_14d: 12, previa_14d: 3 },
                ],
            ],
        ]);
        const data = await getAnalitica();
        // Un solo fenómeno Roblox: gana el de mayor factor (20/5 = ×4 → +300%).
        expect(data.fenomenos).toHaveLength(1);
        expect(data.fenomenos[0].titulo).toBe("Roblox × Ciberacoso: +300% en 14 días");
    });

    it("ráfaga dispara con esRafaga en ventana y cita la plataforma dominante", async () => {
        mockConsultas([
            [F.rafaga, [{ total: 3 }]],
            [F.rafagaPlataforma, [{ plataforma: "Telegram", total: 2 }]],
        ]);
        const data = await getAnalitica();
        expect(data.fenomenos).toHaveLength(1);
        expect(data.fenomenos[0]).toMatchObject({
            tipo: "rafaga",
            sev: "media",
            evidencia: "3 reportes esRafaga en 48 h · plataforma: Telegram",
        });
    });

    it("ráfaga usa la ventana configurable de bi_config", async () => {
        mockConfig({
            "operacion.categorias_sensibles": SENSIBLES_PI,
            "bi.analitica.rafaga_horas": "12",
        });
        mockConsultas([[F.rafaga, [{ total: 2 }]]]);
        const data = await getAnalitica();
        expect(data.fenomenos[0].evidencia).toBe("2 reportes esRafaga en 12 h");
    });

    it("ráfaga en 0 no dispara", async () => {
        mockConsultas([[F.rafaga, [{ total: 0 }]]]);
        const data = await getAnalitica();
        expect(data.fenomenos).toEqual([]);
    });

    it("geo dispara con sigma calculado sobre el histórico de la ciudad", async () => {
        mockConsultas([
            [F.geo, [{ ciudad: "Bucaramanga", actual: 18, media: 6, desvio: 4.5 }]],
        ]);
        const data = await getAnalitica();
        expect(data.fenomenos).toHaveLength(1);
        expect(data.fenomenos[0]).toMatchObject({
            tipo: "geo",
            titulo: "Bucaramanga: +2.7σ sobre su histórico",
            evidencia: "18 reportes esta semana frente a su media de 6 (8 semanas previas)",
            sev: "informativa",
        });
    });

    it("ordena por severidad (alta → media → informativa) y topa en 3", async () => {
        mockConsultas([
            [
                F.plataforma,
                [{ plataforma: "Roblox", categoria: "CIBERACOSO", reciente_14d: 12, previa_14d: 6 }],
            ],
            [F.rafaga, [{ total: 5 }]],
            [
                F.geo,
                [
                    { ciudad: "Bucaramanga", actual: 18, media: 6, desvio: 4.5 },
                    { ciudad: "Cali", actual: 12, media: 4, desvio: 3 },
                ],
            ],
        ]);
        const data = await getAnalitica();
        // 4 candidatos → 3: [plataforma, ráfaga, geo Bucaramanga].
        expect(data.fenomenos.map((f) => f.sev)).toEqual(["alta", "media", "informativa"]);
        expect(data.fenomenos.map((f) => f.tipo)).toEqual(["plataforma", "rafaga", "geo"]);
        expect(data.fenomenos[2].titulo).toContain("Bucaramanga");
    });

    it("sin señales → [] (nunca fabrica un fenómeno)", async () => {
        mockConsultas([]);
        const data = await getAnalitica();
        expect(data.fenomenos).toEqual([]);
    });
});

// ─── (e) frentePadre ─────────────────────────────────────────────────────────

describe("frentePadre · padres como actores (agregados)", () => {
    it("mapea reportes PARENT vs. resto, suscripciones padre e hijos", async () => {
        mockConsultas([
            [F.frenteReportes, [{ reportes_padres: 4, reportes_colegios: 2010 }]],
            [F.frenteComercial, [{ suscripciones_padre: 5, hijos_circulo: 11 }]],
        ]);
        const data = await getAnalitica();
        expect(data.frentePadre).toEqual({
            reportesPadres: 4,
            reportesColegios: 2010,
            suscripcionesPadre: 5,
            hijosCirculo: 11,
        });
    });

    it("vacío honesto: sondeos rotos → ceros", async () => {
        mockConsultas([
            [F.frenteReportes, new Error("sin permisos")],
            [F.frenteComercial, new Error("sin permisos")],
        ]);
        const data = await getAnalitica();
        expect(data.frentePadre).toEqual({
            reportesPadres: 0,
            reportesColegios: 0,
            suscripcionesPadre: 0,
            hijosCirculo: 0,
        });
    });
});

// ─── (f) vencimientos ────────────────────────────────────────────────────────

describe("vencimientos · ventanas (0,7] · (7,15] · (15,30] + freemium", () => {
    it("mapea las tres ventanas y el freemium activo", async () => {
        mockConsultas([
            [
                F.vencimientos,
                [{ esta_semana: 3, en_15d: 6, en_30d: 11, freemium_activo: 3 }],
            ],
        ]);
        const data = await getAnalitica();
        expect(data.vencimientos).toEqual({
            estaSemana: 3,
            en15d: 6,
            en30d: 11,
            freemiumActivo: 3,
        });
    });

    it("sondeo roto → ceros honestos", async () => {
        mockConsultas([[F.vencimientos, new Error("tabla ausente")]]);
        const data = await getAnalitica();
        expect(data.vencimientos).toEqual({
            estaSemana: 0,
            en15d: 0,
            en30d: 0,
            freemiumActivo: 0,
        });
    });
});

// ─── (g) cronologia ──────────────────────────────────────────────────────────

describe("cronologia · 12 meses con marcadores de fenómeno", () => {
    it("marca el mes actual cuando hay fenómeno activo", async () => {
        mockConsultas([
            [F.cronologia, filasCronologia([95, 140, 158, 121, 167, 172, 181, 176, 190, 168, 173, 172])],
            [
                F.plataforma,
                [{ plataforma: "Roblox", categoria: "CIBERACOSO", reciente_14d: 12, previa_14d: 6 }],
            ],
        ]);
        const data = await getAnalitica();
        expect(data.cronologia).toHaveLength(12);
        const actual = data.cronologia.find((m) => m.mes === MES_ACTUAL);
        expect(actual).toMatchObject({ total: 172, conFenomeno: true });
        const octubre = data.cronologia.find((m) => m.mes === "2025-10");
        expect(octubre).toMatchObject({ total: 95, conFenomeno: false });
    });

    it("sin fenómenos ningún mes queda marcado (0s rellenados pasan igual)", async () => {
        mockConsultas([[F.cronologia, filasCronologia()]]);
        const data = await getAnalitica();
        expect(data.cronologia).toHaveLength(12);
        expect(data.cronologia.every((m) => m.total === 0 && !m.conFenomeno)).toBe(true);
    });
});

// ─── Candados transversales ──────────────────────────────────────────────────

describe("candados · defaults B3 y degradación por sección", () => {
    it("config inválida (no numérica) cae al default documentado", async () => {
        mockConfig({
            "operacion.categorias_sensibles": SENSIBLES_PI,
            "bi.analitica.sigma": "abc",
        });
        mockConsultas([
            [F.anomaliaBase, [{ media_28d: 10, desvio_28d: 2 }]],
            [F.anomaliaHoy, [{ hoy: 15, primer_reporte: HACE_UN_ANIO }]],
        ]);
        const data = await getAnalitica();
        // sigma 'abc' → default 2 → 2.5 sigue siendo anómalo.
        expect(data.anomaliaHoy.esAnomalo).toBe(true);
    });

    it("una sección rota degrada a vacío y el resto de Analítica vive", async () => {
        mockConsultas([
            [F.anomaliaBase, new Error("réplica caída")],
            [F.anomaliaHoy, [{ hoy: 7, primer_reporte: HACE_UN_ANIO }]],
            [F.frenteReportes, [{ reportes_padres: 2, reportes_colegios: 40 }]],
        ]);
        const data = await getAnalitica();
        // anomalía sin base estadística → NULLs honestos, hoy sí se reporta.
        expect(data.anomaliaHoy).toEqual({
            sigma: null,
            totalHoy: 7,
            media28d: null,
            esAnomalo: false,
        });
        // Las demás secciones siguieron funcionando.
        expect(data.frentePadre.reportesPadres).toBe(2);
    });
});

// ─── (b·ext) getProyeccion · horizonte parametrizable 4/8/12 ─────────────────

describe("getProyeccion · horizonte 4/8/12 (filtro de tiempo)", () => {
    it("4/8/12 semanas de historia producen rangos DISTINTOS con la misma pendiente", async () => {
        // y = 10 + 2x en cada horizonte → ŷ_{N} = 10 + 2N, residuos 0:
        // 4 → [18,18] · 8 → [26,26] · 12 → [34,34].
        mockConsultas([[F.semanas, filasSemanas([10, 12, 14, 16])]]);
        const p4 = await getProyeccion(4);
        expect(p4.hayBase).toBe(true);
        expect([p4.min, p4.max]).toEqual([18, 18]);
        expect(p4.tendenciaSemanas).toHaveLength(4);

        mockConsultas([[F.semanas, filasSemanas([10, 12, 14, 16, 18, 20, 22, 24])]]);
        const p8 = await getProyeccion(8);
        expect([p8.min, p8.max]).toEqual([26, 26]);
        expect(p8.tendenciaSemanas).toHaveLength(8);

        mockConsultas([
            [F.semanas, filasSemanas([10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32])],
        ]);
        const p12 = await getProyeccion(12);
        expect([p12.min, p12.max]).toEqual([34, 34]);
        expect(p12.tendenciaSemanas).toHaveLength(12);

        // Los tres rangos son distintos entre sí (el filtro cambia el resultado).
        expect(new Set([p4.min, p8.min, p12.min]).size).toBe(3);
    });

    it("NULL honesto sin base: menos de 4 semanas con actividad", async () => {
        mockConsultas([[F.semanas, filasSemanas([0, 0, 0, 5])]]);
        const p = await getProyeccion(4);
        expect(p.hayBase).toBe(false);
        expect(p.min).toBeNull();
        expect(p.max).toBeNull();
        // La serie igual se expone con sus 0 reales (vacío honesto).
        expect(p.tendenciaSemanas.map((s) => s.total)).toEqual([0, 0, 0, 5]);
    });

    it("sondeo degradado → hayBase false, min/max NULL, serie vacía", async () => {
        mockConsultas([[F.semanas, new Error("réplica caída")]]);
        const p = await getProyeccion(12);
        expect(p).toEqual({ min: null, max: null, tendenciaSemanas: [], hayBase: false });
    });
});

// ─── (h) getDetalleMes · drill-down de la timeline ───────────────────────────

/** Los 12 meses del año calendario de `mes` (forma de la query detalle-mes-anio). */
function filasAnioDe(mes: string, totales: number[]): Filas {
    const anio = mes.slice(0, 4);
    return totales.map((total, i) => ({
        mes: `${anio}-${String(i + 1).padStart(2, "0")}`,
        total,
    }));
}

describe("getDetalleMes · qué pasó en un mes", () => {
    it("mes válido con datos: total, categoría top, alertas, escaladas y anónimos", async () => {
        mockConsultas([
            [FD.totales, [{ total: 40, anonimos: 12 }]],
            [FD.categoria, [{ categoria: "CIBERACOSO", total: 18 }]],
            [FD.alertas, [{ total: 7, escaladas: 2 }]],
            [FD.rafaga, [{ total: 0 }]],
            // Año plano en 40 → desvío 0: sin dispersión no hay pico honesto.
            [FD.anio, filasAnioDe("2026-03", Array(12).fill(40))],
        ]);
        const detalle = await getDetalleMes("2026-03");
        expect(detalle).toEqual({
            mes: "2026-03",
            total: 40,
            categoriaTop: { categoria: "CIBERACOSO", total: 18 },
            alertasDelMes: 7,
            escaladasDelMes: 2,
            fenomenos: [],
            anonimos: 12,
        });
    });

    it("categoría top NULL si ningún reporte del mes quedó clasificado (candado 9)", async () => {
        mockConsultas([
            [FD.totales, [{ total: 5, anonimos: 5 }]],
            [FD.categoria, []], // sin filas: nadie clasificado ese mes
            [FD.alertas, [{ total: 0, escaladas: 0 }]],
            [FD.rafaga, [{ total: 0 }]],
            [FD.anio, filasAnioDe("2026-03", Array(12).fill(5))],
        ]);
        const detalle = await getDetalleMes("2026-03");
        expect(detalle?.categoriaTop).toBeNull();
        expect(detalle?.total).toBe(5);
    });

    it("fenómenos del mes: ráfaga esRafaga y pico σ sobre la media anual", async () => {
        mockConsultas([
            [FD.totales, [{ total: 40, anonimos: 0 }]],
            [FD.categoria, []],
            [FD.alertas, [{ total: 0, escaladas: 0 }]],
            [FD.rafaga, [{ total: 3 }]],
            // Marzo con 40 y el resto del año en 10 → media 12.5, desvío
            // √75 ≈ 8.66 → 40 > 12.5 + 2·8.66 → pico de +3.2σ.
            [FD.anio, filasAnioDe("2026-03", [10, 10, 40, 10, 10, 10, 10, 10, 10, 10, 10, 10])],
        ]);
        const detalle = await getDetalleMes("2026-03");
        expect(detalle?.fenomenos).toEqual([
            "3 reportes con marca de ráfaga (esRafaga) del antifraude en el mes",
            "Pico del año: 40 reportes, +3.2σ sobre la media anual de 12.5",
        ]);
    });

    it("mes sin reportes → null (la ruta lo traduce a 404 sin_datos)", async () => {
        mockConsultas([[FD.totales, [{ total: 0, anonimos: 0 }]]]);
        expect(await getDetalleMes("2026-03")).toBeNull();
    });

    it.each(["2026-13", "2026-00", "2026-3", "abc", "2026-03-15", ""])(
        "formato inválido ('%s') → null SIN tocar la BD",
        async (mes) => {
            expect(await getDetalleMes(mes)).toBeNull();
            expect(queryRawMock).not.toHaveBeenCalled();
        },
    );
});

// ─── Rutas · GET detalle-mes y proyeccion ────────────────────────────────────

describe("GET /api/bi/analitica/detalle-mes", () => {
    function req(query: string): Request {
        return new Request(`http://localhost:3001/api/bi/analitica/detalle-mes${query}`);
    }

    it("sin sesión → 401 y la BD NO se toca", async () => {
        leerSesionMock.mockResolvedValue(null);
        const res = await GET_DETALLE_MES(req("?mes=2026-03"));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "no_autorizado" });
        expect(queryRawMock).not.toHaveBeenCalled();
    });

    it.each(["?mes=2026-13", "?mes=marzo", "?mes=", ""])(
        "mes mal formado ('%s') → 400 formato_invalido",
        async (query) => {
            const res = await GET_DETALLE_MES(req(query));
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "formato_invalido" });
            expect(queryRawMock).not.toHaveBeenCalled();
        },
    );

    it("mes con datos → 200 con el DetalleMes", async () => {
        mockConsultas([
            [FD.totales, [{ total: 40, anonimos: 12 }]],
            [FD.categoria, [{ categoria: "CIBERACOSO", total: 18 }]],
            [FD.alertas, [{ total: 7, escaladas: 2 }]],
            [FD.rafaga, [{ total: 0 }]],
            [FD.anio, filasAnioDe("2026-03", Array(12).fill(40))],
        ]);
        const res = await GET_DETALLE_MES(req("?mes=2026-03"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            mes: "2026-03",
            total: 40,
            categoriaTop: { categoria: "CIBERACOSO", total: 18 },
            alertasDelMes: 7,
            escaladasDelMes: 2,
            fenomenos: [],
            anonimos: 12,
        });
    });

    it("mes válido sin reportes → 404 sin_datos", async () => {
        mockConsultas([[FD.totales, [{ total: 0, anonimos: 0 }]]]);
        const res = await GET_DETALLE_MES(req("?mes=2026-03"));
        expect(res.status).toBe(404);
        expect(await res.json()).toEqual({ error: "sin_datos" });
    });
});

describe("GET /api/bi/analitica/proyeccion", () => {
    function req(query: string): Request {
        return new Request(`http://localhost:3001/api/bi/analitica/proyeccion${query}`);
    }

    it("sin sesión → 401 y la BD NO se toca", async () => {
        leerSesionMock.mockResolvedValue(null);
        const res = await GET_PROYECCION(req("?semanas=4"));
        expect(res.status).toBe(401);
        expect(await res.json()).toEqual({ error: "no_autorizado" });
        expect(queryRawMock).not.toHaveBeenCalled();
    });

    it.each(["?semanas=6", "?semanas=0", "?semanas=ocho"])(
        "horizonte fuera de 4/8/12 ('%s') → 400 horizonte_invalido",
        async (query) => {
            const res = await GET_PROYECCION(req(query));
            expect(res.status).toBe(400);
            expect(await res.json()).toEqual({ error: "horizonte_invalido" });
            expect(queryRawMock).not.toHaveBeenCalled();
        },
    );

    it("semanas=4 → 200 con la proyección de 4 semanas", async () => {
        mockConsultas([[F.semanas, filasSemanas([10, 12, 14, 16])]]);
        const res = await GET_PROYECCION(req("?semanas=4"));
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({
            min: 18,
            max: 18,
            hayBase: true,
            tendenciaSemanas: filasSemanas([10, 12, 14, 16]),
        });
    });

    it("sin parámetro → horizonte default 8 (compatibilidad)", async () => {
        mockConsultas([[F.semanas, filasSemanas([10, 12, 14, 16, 18, 20, 22, 24])]]);
        const res = await GET_PROYECCION(req(""));
        expect(res.status).toBe(200);
        const cuerpo = await res.json();
        expect(cuerpo.min).toBe(26);
        expect(cuerpo.tendenciaSemanas).toHaveLength(8);
    });
});
