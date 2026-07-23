import { describe, it, expect, beforeEach, vi } from "vitest";

const mockSimRepFindMany = vi.hoisted(() => vi.fn());
const mockReporteFindMany = vi.hoisted(() => vi.fn());
const mockClasifFindMany = vi.hoisted(() => vi.fn());
const mockParametroFindUnique = vi.hoisted(() => vi.fn());

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
        parametroSistema: {
            findUnique: (...args: unknown[]) => mockParametroFindUnique(...args),
        },
    },
}));

import { calcularMetricasSimulacion } from "./metricas";

describe("metricas.ts — calcularMetricasSimulacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParametroFindUnique.mockResolvedValue(null);
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

describe("metricas.ts — ADR_006 (seguridad)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParametroFindUnique.mockResolvedValue(null); // umbral default 1.0, severidad default del código
        mockSimRepFindMany.mockResolvedValue([
            { reporteId: "r1", indice: 1, categoriaEsperada: "SOLICITUD_ENCUENTRO", secundariaEsperada: null },
            { reporteId: "r2", indice: 2, categoriaEsperada: "CONTACTO_INSISTENTE", secundariaEsperada: null },
            { reporteId: "r3", indice: 3, categoriaEsperada: "DIFUSION_NO_CONSENTIDA", secundariaEsperada: "COMPARTIMIENTO_SEXUAL" },
            { reporteId: "r4", indice: 4, categoriaEsperada: "EXTORSION", secundariaEsperada: null },
        ]);
        mockReporteFindMany.mockResolvedValue([
            { id: "r1", identificador: "SIM-1", estado: "CLASIFICADO" },
            { id: "r2", identificador: "SIM-2", estado: "CLASIFICADO" },
            { id: "r3", identificador: "SIM-3", estado: "CLASIFICADO" },
            { id: "r4", identificador: "SIM-4", estado: "CLASIFICADO" },
        ]);
        mockClasifFindMany.mockResolvedValue([
            // fallo GRAVE→leve (subestima) con confianza 1.0 → silencioso
            { reporteId: "r1", categoria: "CONTACTO_INSISTENTE", confianza: 1.0, latenciaMs: 1000, usoCascada: false },
            // fallo leve→GRAVE (sobreestima) con confianza 0.7 → NO silencioso (< 1.0)
            { reporteId: "r2", categoria: "SOLICITUD_ENCUENTRO", confianza: 0.7, latenciaMs: 1000, usoCascada: false },
            // multi-etiqueta: asigna la secundaria → ACIERTO
            { reporteId: "r3", categoria: "COMPARTIMIENTO_SEXUAL", confianza: 0.9, latenciaMs: 1000, usoCascada: false },
            // fallo GRAVE→leve con confianza 1.0 → segundo silencioso
            { reporteId: "r4", categoria: "OTRO", confianza: 1.0, latenciaMs: 1000, usoCascada: false },
        ]);
    });

    it("multi-etiqueta: la secundaria cuenta como acierto", async () => {
        const m = await calcularMetricasSimulacion("run-1");
        expect(m.aciertos).toBe(1); // solo r3
        expect(m.fallos).toBe(3);
    });

    it("errores silenciosos: fallos con confianza >= umbral_revision", async () => {
        const m = await calcularMetricasSimulacion("run-1");
        expect(m.erroresSilenciosos.count).toBe(2); // r1 y r4 (confianza 1.0)
        expect(m.erroresSilenciosos.casos.map((c) => c.indice).sort()).toEqual([1, 4]);
    });

    it("subestimaciones: fallos que bajan de severidad, con severidad perdida", async () => {
        const m = await calcularMetricasSimulacion("run-1");
        // r1: SOLICITUD_ENCUENTRO(90)→CONTACTO_INSISTENTE(30) = -60; r4: EXTORSION(85)→OTRO(20) = -65
        expect(m.subestimaciones.count).toBe(2);
        expect(m.subestimaciones.severidadPerdida).toBe(125);
    });

    it("ESPS: Σ|Δ| sobre silenciosos con subestimaciones ×3", async () => {
        const m = await calcularMetricasSimulacion("run-1");
        // silenciosos: r1 (Δ=-60 → 60*3=180) + r4 (Δ=-65 → 65*3=195) = 375
        expect(m.esps).toBe(375);
    });

    it("calcularEsps es pura: pondera solo deltas negativos", async () => {
        const { calcularEsps } = await import("./metricas");
        expect(calcularEsps([{ deltaSeveridad: -10 }, { deltaSeveridad: 10 }])).toBe(40);
        expect(calcularEsps([])).toBe(0);
    });
});
