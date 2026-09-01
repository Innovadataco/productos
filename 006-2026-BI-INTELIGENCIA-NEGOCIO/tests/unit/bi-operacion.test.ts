// tests/unit/bi-operacion.test.ts · Contrato de src/lib/bi/operacion.ts
// Producto 006 · BI v2 · Operación (Fase 3)
// Unitarios puros: prisma.$queryRaw y getConfig mockeados — sin BD, sin red.
// El "ahora" se congela con fake timers para que el semáforo sea determinista.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryRawMock, getConfigMock } = vi.hoisted(() => ({
    queryRawMock: vi.fn(),
    getConfigMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { $queryRaw: queryRawMock } }));
vi.mock("@/lib/config", () => ({ getConfig: getConfigMock }));

import { getMinutosBadgeNuevo, getOperacion } from "@/lib/bi/operacion";

// "Ahora" fijo: 2026-09-01 12:00 UTC.
const AHORA = new Date("2026-09-01T12:00:00Z");
const minAtras = (min: number) => new Date(AHORA.getTime() - min * 60000);

interface FilaAgregada {
    colegio_id: string;
    colegio: string;
    tenant_id: string;
    reportes_mes: number;
    hoy: number;
    ultimo_reporte: Date | null;
}

function agregada(
    parcial: Partial<FilaAgregada> & { colegio: string; tenant_id: string },
): FilaAgregada {
    return {
        colegio_id: `id-${parcial.tenant_id}`,
        reportes_mes: 0,
        hoy: 0,
        ultimo_reporte: null,
        ...parcial,
    };
}

/** getConfig devuelve null (defaults) salvo los overrides dados. */
function configCon(overrides: Record<string, string> = {}) {
    getConfigMock.mockImplementation(async (clave: string) => overrides[clave] ?? null);
}

/**
 * Encola las cuatro respuestas de $queryRaw en el orden fijo del módulo:
 * agregados → categorías → alertas → personas. Los dos últimos tienen
 * default [] (un colegio sin filas en AlertaColegio/personas vale 0).
 */
function bdCon(
    agregados: FilaAgregada[],
    categorias: unknown[],
    alertas: unknown[] = [],
    personas: unknown[] = [],
) {
    queryRawMock.mockReset();
    queryRawMock
        .mockResolvedValueOnce(agregados)
        .mockResolvedValueOnce(categorias)
        .mockResolvedValueOnce(alertas)
        .mockResolvedValueOnce(personas);
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(AHORA);
    vi.clearAllMocks();
    configCon();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("getOperacion · semáforo determinista", () => {
    it("bad: colegio que NUNCA reportó (ultimo_reporte NULL)", async () => {
        bdCon(
            [agregada({ colegio: "Col. Nuevo", tenant_id: "t1" })],
            [],
        );
        const { filas } = await getOperacion();
        expect(filas).toHaveLength(1);
        expect(filas[0].estado).toBe("bad");
        expect(filas[0].estadoEtiqueta).toBe("Sin actividad");
        // Candado 9: NULL honesto, nunca un cero disfrazado.
        expect(filas[0].ultimoReporteHaceMin).toBeNull();
        expect(filas[0].categoriaTop).toBeNull();
        expect(filas[0].reportesMes).toBe(0);
        expect(filas[0].hoy).toBe(0);
    });

    it("bad: último reporte hace más de 30 días (default)", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Dormido",
                    tenant_id: "t1",
                    reportes_mes: 0,
                    ultimo_reporte: minAtras(40 * 24 * 60),
                }),
            ],
            [],
        );
        const { filas } = await getOperacion();
        expect(filas[0].estado).toBe("bad");
        expect(filas[0].ultimoReporteHaceMin).toBe(40 * 24 * 60);
    });

    it("warn: actividad en las últimas 6 horas", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Activo",
                    tenant_id: "t1",
                    reportes_mes: 5,
                    hoy: 2,
                    ultimo_reporte: minAtras(30),
                }),
            ],
            [{ tenant_id: "t1", categoria: "OTRO", total: 5 }],
        );
        const { filas } = await getOperacion();
        expect(filas[0].estado).toBe("warn");
        expect(filas[0].estadoEtiqueta).toBe("En atención");
        expect(filas[0].ultimoReporteHaceMin).toBe(30);
        expect(filas[0].categoriaTop).toBe("OTRO");
    });

    it("warn: categoría sensible recurrente (≥3 en el mes) aunque no haya actividad reciente", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Sensible",
                    tenant_id: "t1",
                    reportes_mes: 4,
                    ultimo_reporte: minAtras(2 * 24 * 60),
                }),
            ],
            [
                { tenant_id: "t1", categoria: "SOLICITUD_MATERIAL", total: 3 },
                { tenant_id: "t1", categoria: "OTRO", total: 1 },
            ],
        );
        const { filas } = await getOperacion();
        expect(filas[0].estado).toBe("warn");
        expect(filas[0].categoriaTop).toBe("SOLICITUD_MATERIAL");
    });

    it("ok: actividad vieja sin categoría sensible y hoy = 0", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Tranquilo",
                    tenant_id: "t1",
                    reportes_mes: 3,
                    hoy: 0,
                    ultimo_reporte: minAtras(2 * 24 * 60),
                }),
            ],
            [
                // Empate 2-2: gana el orden alfabético (determinista).
                { tenant_id: "t1", categoria: "SPAM", total: 2 },
                { tenant_id: "t1", categoria: "OTRO", total: 2 },
            ],
        );
        const { filas } = await getOperacion();
        expect(filas[0].estado).toBe("ok");
        expect(filas[0].estadoEtiqueta).toBe("En calma");
        expect(filas[0].hoy).toBe(0);
        expect(filas[0].categoriaTop).toBe("OTRO");
    });

    it("ok: categoría sensible por debajo del mínimo de repetición NO escala a warn", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Caso Aislado",
                    tenant_id: "t1",
                    reportes_mes: 2,
                    ultimo_reporte: minAtras(2 * 24 * 60),
                }),
            ],
            [{ tenant_id: "t1", categoria: "EXTORSION", total: 2 }],
        );
        const { filas } = await getOperacion();
        expect(filas[0].estado).toBe("ok");
        expect(filas[0].categoriaTop).toBe("EXTORSION");
    });
});

describe("getOperacion · resumen", () => {
    it("cuenta activos, en atención, sin actividad y reportes de hoy", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Activo",
                    tenant_id: "t1",
                    reportes_mes: 5,
                    hoy: 2,
                    ultimo_reporte: minAtras(30),
                }),
                agregada({
                    colegio: "Col. Sensible",
                    tenant_id: "t2",
                    reportes_mes: 3,
                    ultimo_reporte: minAtras(2 * 24 * 60),
                }),
                agregada({ colegio: "Col. Nuevo", tenant_id: "t3" }),
                agregada({
                    colegio: "Col. Tranquilo",
                    tenant_id: "t4",
                    reportes_mes: 1,
                    hoy: 1,
                    ultimo_reporte: minAtras(3 * 24 * 60),
                }),
            ],
            [{ tenant_id: "t2", categoria: "EXTORSION", total: 3 }],
        );
        const { resumen } = await getOperacion();
        expect(resumen).toEqual({
            activos: 4,
            enAtencion: 2, // t1 por actividad reciente · t2 por EXTORSION recurrente
            sinActividad: 1, // t3 nunca reportó
            reportesHoy: 3,
            conAlertasPorGestionar: 0, // sin filas en AlertaColegio → 0 real
            conEscaladasSinGestion: 0,
        });
    });

    it("réplica vacía: cero filas y resumen en cero (sin inventar cifras)", async () => {
        bdCon([], []);
        const { filas, resumen } = await getOperacion();
        expect(filas).toEqual([]);
        expect(resumen).toEqual({
            activos: 0,
            enAtencion: 0,
            sinActividad: 0,
            reportesHoy: 0,
            conAlertasPorGestionar: 0,
            conEscaladasSinGestion: 0,
        });
    });
});

describe("getOperacion · alertas y personas por colegio (ampliación v3)", () => {
    it("mergea alertas y rosters por colegio_id; ausencia de filas = 0 real", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Activo",
                    tenant_id: "t1",
                    reportes_mes: 5,
                    ultimo_reporte: minAtras(30),
                }),
                agregada({
                    colegio: "Col. Tranquilo",
                    tenant_id: "t2",
                    reportes_mes: 1,
                    ultimo_reporte: minAtras(3 * 24 * 60),
                }),
            ],
            [],
            // Solo t1 tiene filas en AlertaColegio.
            [{ colegio_id: "id-t1", alertas_activas: 3, escaladas: 0 }],
            [
                { colegio_id: "id-t1", profesores: 40, alumnos: 320 },
                { colegio_id: "id-t2", profesores: 12, alumnos: 95 },
            ],
        );
        const { filas, resumen } = await getOperacion();

        expect(filas[0].alertasActivas).toBe(3);
        expect(filas[0].escaladas).toBe(0);
        expect(filas[0].profesores).toBe(40);
        expect(filas[0].alumnos).toBe(320);
        // t2 sin filas de alertas → 0 (ausencia de filas = conteo real en cero)
        expect(filas[1].alertasActivas).toBe(0);
        expect(filas[1].profesores).toBe(12);
        expect(resumen.conAlertasPorGestionar).toBe(1);
        expect(resumen.conEscaladasSinGestion).toBe(0);
    });

    it("warn por escaladas sin gestión aunque el resto esté en calma (etiqueta propia)", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Escalado",
                    tenant_id: "t1",
                    reportes_mes: 2,
                    ultimo_reporte: minAtras(2 * 24 * 60), // sin actividad reciente
                }),
            ],
            [{ tenant_id: "t1", categoria: "OTRO", total: 2 }], // nada sensible
            [{ colegio_id: "id-t1", alertas_activas: 4, escaladas: 2 }],
            [],
        );
        const { filas, resumen } = await getOperacion();

        expect(filas[0].estado).toBe("warn");
        expect(filas[0].estadoEtiqueta).toBe("Escaladas sin gestión");
        expect(resumen.enAtencion).toBe(1);
        expect(resumen.conEscaladasSinGestion).toBe(1);
    });

    it("bad sigue ganando aunque haya escaladas (orden documentado del semáforo)", async () => {
        bdCon(
            [agregada({ colegio: "Col. Dormido", tenant_id: "t1" })], // jamás reportó
            [],
            [{ colegio_id: "id-t1", alertas_activas: 2, escaladas: 1 }],
            [],
        );
        const { filas } = await getOperacion();
        expect(filas[0].estado).toBe("bad");
        expect(filas[0].estadoEtiqueta).toBe("Sin actividad");
        // Las cifras de alertas viajan en la fila aunque el semáforo sea bad.
        expect(filas[0].escaladas).toBe(1);
    });

    it("alertas nuevas sin escaladas NO disparan warn por sí solas", async () => {
        bdCon(
            [
                agregada({
                    colegio: "Col. Con Nuevas",
                    tenant_id: "t1",
                    reportes_mes: 3,
                    ultimo_reporte: minAtras(2 * 24 * 60),
                }),
            ],
            [{ tenant_id: "t1", categoria: "OTRO", total: 3 }],
            [{ colegio_id: "id-t1", alertas_activas: 5, escaladas: 0 }],
            [],
        );
        const { filas, resumen } = await getOperacion();
        expect(filas[0].estado).toBe("ok");
        expect(filas[0].estadoEtiqueta).toBe("En calma");
        expect(filas[0].alertasActivas).toBe(5);
        expect(resumen.conAlertasPorGestionar).toBe(1);
    });
});

describe("getOperacion · umbrales desde bi_config (B3)", () => {
    it("un umbral configurado pisa el default del semáforo", async () => {
        // Con el default (6 h) este colegio sería warn; con 1 h configurada, ok.
        const datos = () =>
            bdCon(
                [
                    agregada({
                        colegio: "Col. Borde",
                        tenant_id: "t1",
                        reportes_mes: 2,
                        ultimo_reporte: minAtras(90),
                    }),
                ],
                [{ tenant_id: "t1", categoria: "OTRO", total: 2 }],
            );

        datos();
        const conDefault = await getOperacion();
        expect(conDefault.filas[0].estado).toBe("warn");

        configCon({ "operacion.horas_actividad_warn": "1" });
        datos();
        const configurado = await getOperacion();
        expect(configurado.filas[0].estado).toBe("ok");
    });
});

describe("getMinutosBadgeNuevo", () => {
    it("default 120 sin config; respeta el valor configurado", async () => {
        await expect(getMinutosBadgeNuevo()).resolves.toBe(120);
        configCon({ "operacion.minutos_badge_nuevo": "45" });
        await expect(getMinutosBadgeNuevo()).resolves.toBe(45);
    });
});
