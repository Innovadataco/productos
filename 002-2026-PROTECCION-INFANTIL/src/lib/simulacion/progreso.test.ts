import { describe, it, expect, beforeEach, vi } from "vitest";

const mockRunFindUnique = vi.hoisted(() => vi.fn());
const mockRunUpdate = vi.hoisted(() => vi.fn());
const mockSimRepFindMany = vi.hoisted(() => vi.fn());
const mockSimRepFindUnique = vi.hoisted(() => vi.fn());
const mockReporteFindMany = vi.hoisted(() => vi.fn());
const mockParametroFindUnique = vi.hoisted(() => vi.fn());
const mockClasifFindMany = vi.hoisted(() => vi.fn());
const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        simulacionRun: {
            findUnique: (...args: unknown[]) => mockRunFindUnique(...args),
            update: (...args: unknown[]) => mockRunUpdate(...args),
        },
        simulacionReporte: {
            findMany: (...args: unknown[]) => mockSimRepFindMany(...args),
            findUnique: (...args: unknown[]) => mockSimRepFindUnique(...args),
        },
        reporte: {
            findMany: (...args: unknown[]) => mockReporteFindMany(...args),
        },
        clasificacionIA: {
            findMany: (...args: unknown[]) => mockClasifFindMany(...args),
        },
        parametroSistema: {
            findUnique: (...args: unknown[]) => mockParametroFindUnique(...args),
        },
    },
}));

vi.mock("@/lib/logger", () => ({
    logger: {
        info: vi.fn(),
        warn: (...args: unknown[]) => mockLoggerWarn(...args),
        error: (...args: unknown[]) => mockLoggerError(...args),
    },
}));

import { actualizarProgresoYEstado, tieneMetricasCompletas, marcarProgresoSimulacionPorReporte } from "./progreso";

function runBase(overrides: Record<string, unknown> = {}) {
    return {
        id: "run-1",
        estado: "EN_PROGRESO",
        totalCasos: 3,
        progreso: 0,
        fechaInicio: new Date(),
        fechaFin: null,
        metricasJson: null,
        ...overrides,
    };
}

function mockVinculosYReportes(estados: string[]) {
    mockSimRepFindMany.mockResolvedValue(estados.map((_, i) => ({ reporteId: `r${i}` })));
    mockReporteFindMany.mockResolvedValue(estados.map((estado) => ({ estado })));
}

describe("progreso.ts — actualizarProgresoYEstado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParametroFindUnique.mockResolvedValue(null); // timeout default 60
        mockRunUpdate.mockResolvedValue({});
        mockClasifFindMany.mockResolvedValue([]);
    });

    it("actualiza progreso sin cerrar mientras falten casos", async () => {
        mockRunFindUnique.mockResolvedValue(runBase());
        mockVinculosYReportes(["CLASIFICADO", "PENDIENTE", "PROCESANDO"]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result).toEqual({ progreso: 1, estado: "EN_PROGRESO" });
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({ data: expect.objectContaining({ progreso: 1, estado: "EN_PROGRESO" }) })
        );
    });

    it("pasa a COMPLETADA cuando progreso alcanza el total y calcula métricas", async () => {
        // 1ª lectura: EN_PROGRESO (transición); 2ª lectura (refresco de métricas): ya COMPLETADA
        mockRunFindUnique
            .mockResolvedValueOnce(runBase())
            .mockResolvedValue(runBase({ estado: "COMPLETADA", progreso: 3 }));
        mockVinculosYReportes(["CLASIFICADO", "CLASIFICADO", "REVISION_MANUAL"]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result.estado).toBe("COMPLETADA");
        expect(mockRunUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ estado: "COMPLETADA", fechaFin: expect.any(Date) }),
            })
        );
        // refrescarMetricasSimulacion: segunda actualización con metricasJson calculado
        const updateMetricas = mockRunUpdate.mock.calls.find((c) => c[0]?.data?.metricasJson !== undefined);
        expect(updateMetricas).toBeTruthy();
        expect(updateMetricas![0].data.metricasJson).toHaveProperty("accuracy");
    });

    it("los casosFallidos (no encolados) no bloquean el cierre", async () => {
        mockRunFindUnique.mockResolvedValue(runBase({ metricasJson: { casosFallidos: 1 } }));
        // Solo 2 encolados de 3; ambos clasificados → total efectivo 2
        mockVinculosYReportes(["CLASIFICADO", "CLASIFICADO"]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result.estado).toBe("COMPLETADA");
    });

    it("marca FALLIDA cuando supera el timeout", async () => {
        const hace2Horas = new Date(Date.now() - 2 * 60 * 60 * 1000);
        mockRunFindUnique.mockResolvedValue(runBase({ fechaInicio: hace2Horas }));
        mockVinculosYReportes(["CLASIFICADO", "PENDIENTE", "PENDIENTE"]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result.estado).toBe("FALLIDA");
        expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it("usa el timeout de ParametroSistema si existe", async () => {
        mockParametroFindUnique.mockResolvedValue({ valor: "1" }); // 1 minuto
        const hace5Min = new Date(Date.now() - 5 * 60 * 1000);
        mockRunFindUnique.mockResolvedValue(runBase({ fechaInicio: hace5Min }));
        mockVinculosYReportes(["PENDIENTE", "PENDIENTE", "PENDIENTE"]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result.estado).toBe("FALLIDA");
    });

    it("I-07: NO marca FALLIDA si fechaInicio (arranque propio) es reciente, aunque la creación sea antigua", async () => {
        // Hueco multi-modelo: la run se creó hace 2 h junto al lote, pero arrancó hace 5 min.
        mockRunFindUnique.mockResolvedValue(
            runBase({
                createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
                fechaInicio: new Date(Date.now() - 5 * 60 * 1000),
            })
        );
        mockVinculosYReportes(["CLASIFICADO", "PENDIENTE", "PENDIENTE"]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result.estado).toBe("EN_PROGRESO");
        expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it("retorna temprano en estados finales sin tocar la BD", async () => {
        mockRunFindUnique.mockResolvedValue(runBase({ estado: "COMPLETADA", progreso: 3 }));

        const result = await actualizarProgresoYEstado("run-1");

        expect(result).toEqual({ progreso: 3, estado: "COMPLETADA" });
        expect(mockRunUpdate).not.toHaveBeenCalled();
    });

    it("no cierra si el estado es PENDIENTE (aún no arranca el batch)", async () => {
        mockRunFindUnique.mockResolvedValue(runBase({ estado: "PENDIENTE" }));
        mockVinculosYReportes([]);

        const result = await actualizarProgresoYEstado("run-1");

        expect(result.estado).toBe("PENDIENTE");
    });
});

describe("progreso.ts — tieneMetricasCompletas", () => {
    it("false si es null o le falta accuracy", () => {
        expect(tieneMetricasCompletas(null)).toBe(false);
        expect(tieneMetricasCompletas({ casosFallidos: 0 })).toBe(false);
    });

    it("true si tiene accuracy numérico", () => {
        expect(tieneMetricasCompletas({ accuracy: 0.98, casosFallidos: 0 })).toBe(true);
    });
});

describe("progreso.ts — marcarProgresoSimulacionPorReporte", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParametroFindUnique.mockResolvedValue(null);
    });

    it("no hace nada si el reporte no pertenece a una simulación", async () => {
        mockSimRepFindUnique.mockResolvedValue(null);

        await marcarProgresoSimulacionPorReporte("r-x");

        expect(mockRunFindUnique).not.toHaveBeenCalled();
    });

    it("actualiza el run si el reporte pertenece a una simulación", async () => {
        mockSimRepFindUnique.mockResolvedValue({ simulacionRunId: "run-1" });
        mockRunFindUnique.mockResolvedValue(runBase());
        mockVinculosYReportes(["CLASIFICADO", "PENDIENTE", "PENDIENTE"]);
        mockClasifFindMany.mockResolvedValue([]);

        await marcarProgresoSimulacionPorReporte("r0");

        expect(mockRunFindUnique).toHaveBeenCalledWith({ where: { id: "run-1" } });
    });

    it("es fail-open: un error interno no se propaga", async () => {
        mockSimRepFindUnique.mockRejectedValue(new Error("BD caída"));

        await expect(marcarProgresoSimulacionPorReporte("r-x")).resolves.toBeUndefined();
        expect(mockLoggerError).toHaveBeenCalled();
    });
});
