import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSimRepFindMany = vi.hoisted(() => vi.fn());
const mockReporteFindMany = vi.hoisted(() => vi.fn());
const mockClasifFindMany = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({
    prisma: {
        simulacionReporte: {
            findMany: (...args: unknown[]) => mockSimRepFindMany(...args),
        },
        reporte: {
            findMany: (...args: unknown[]) => mockReporteFindMany(...args),
        },
        clasificacionIA: {
            findMany: (...args: unknown[]) => mockClasifFindMany(...args),
        },
    },
}));

import { calcularMetricasSimulacion } from "./metricas";

describe("metricas.ts — calcularMetricasSimulacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSimRepFindMany.mockResolvedValue([
            { reporteId: "r1", indice: 1, categoriaEsperada: "EXTORSION" },
            { reporteId: "r2", indice: 2, categoriaEsperada: "EXTORSION" },
            { reporteId: "r3", indice: 3, categoriaEsperada: "OFRECIMIENTO_REGALOS" },
        ]);
        mockReporteFindMany.mockResolvedValue([
            { id: "r1", identificador: "SIM-1", estado: "CLASIFICADO" },
            { id: "r2", identificador: "SIM-2", estado: "CLASIFICADO" },
            { id: "r3", identificador: "SIM-3", estado: "CLASIFICADO" },
        ]);
        mockClasifFindMany.mockResolvedValue([
            { reporteId: "r1", categoria: "EXTORSION", confianza: 0.9, latenciaMs: 1000, usoCascada: false },
            { reporteId: "r2", categoria: "CONTACTO_INSISTENTE", confianza: 0.7, latenciaMs: 3000, usoCascada: true },
            { reporteId: "r3", categoria: "OFRECIMIENTO_REGALOS", confianza: 0.95, latenciaMs: 2000, usoCascada: true },
        ]);
    });

    it("calcula accuracy, aciertos y fallos contra categoriaEsperada", async () => {
        const m = await calcularMetricasSimulacion("run-1");

        expect(m.aciertos).toBe(2);
        expect(m.fallos).toBe(1);
        expect(m.accuracy).toBeCloseTo(2 / 3);
    });

    it("calcula latencia promedio, p50 y p95", async () => {
        const m = await calcularMetricasSimulacion("run-1");

        expect(m.latenciaPromedioMs).toBe(2000);
        expect(m.latenciaP50Ms).toBe(2000);
        expect(m.latenciaP95Ms).toBeGreaterThanOrEqual(2000);
    });

    it("cuenta el uso de desempate (usoCascada)", async () => {
        const m = await calcularMetricasSimulacion("run-1");

        expect(m.usoDesempate.casos).toBe(2);
        expect(m.usoDesempate.porcentaje).toBeCloseTo(2 / 3);
    });

    it("sin clasificaciones: métricas en cero, sin romperse", async () => {
        mockClasifFindMany.mockResolvedValue([]);

        const m = await calcularMetricasSimulacion("run-1");

        expect(m.latenciaPromedioMs).toBe(0);
        expect(m.latenciaP50Ms).toBe(0);
        expect(m.usoDesempate).toEqual({ casos: 0, porcentaje: 0 });
        expect(m.aciertos).toBe(0);
        expect(m.fallos).toBe(3);
    });
});
