import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { KpisDashboardHome } from "@/components/bi/kpis/KpisDashboardHome";

const fetchOrig = global.fetch;

function mockKpis(over: Record<string, unknown> = {}) {
    const base = {
        generadoEn: "2026-08-29T20:00:00Z",
        kpis: {
            reportes24h: { valor: 42 },
            alertasActivas: { valor: 5 },
            colegiosActivos: { valor: 3 },
            suscActivas: { valor: 7 },
            mrrMesActualCop: { valor: 1500000 },
            uptime: {
                biNext: { ok: true, latMs: 0 },
                biVanna: { ok: true, latMs: 120 },
                piApp: { ok: true, latMs: 200 },
            },
        },
    };
    return { ...base, ...over };
}

beforeEach(() => {
    global.fetch = vi.fn();
});

afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = fetchOrig;
});

describe("KpisDashboardHome", () => {
    it("muestra loading state antes de que el fetch resuelva", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
            () => new Promise(() => {}),
        );
        render(<KpisDashboardHome />);
        expect(screen.getByTestId("kpis-loading")).toBeTruthy();
    });

    it("renderiza las 6 tarjetas (5 KPIs + uptime) con data completa", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(JSON.stringify(mockKpis()), { status: 200 }),
        );
        render(<KpisDashboardHome />);
        await waitFor(() =>
            expect(screen.queryByTestId("kpis-grid")).toBeTruthy(),
        );
        expect(screen.getByTestId("kpi-reportes-ltimas-24-h")).toBeTruthy();
        expect(screen.getByTestId("kpi-alertas-activas-7-d-")).toBeTruthy();
        expect(screen.getByTestId("kpi-colegios-activos")).toBeTruthy();
        expect(screen.getByTestId("kpi-suscripciones-activas")).toBeTruthy();
        expect(screen.getByTestId("kpi-mrr-mes-actual-cop-")).toBeTruthy();
        expect(screen.getByTestId("kpi-uptime")).toBeTruthy();
    });

    it("muestra 'sin datos aún' cuando un KPI tiene valor null (candado 9)", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(
                JSON.stringify(
                    mockKpis({
                        kpis: {
                            ...mockKpis().kpis,
                            reportes24h: { valor: null },
                        },
                    }),
                ),
                { status: 200 },
            ),
        );
        render(<KpisDashboardHome />);
        await waitFor(() =>
            expect(screen.queryByTestId("kpis-grid")).toBeTruthy(),
        );
        // "sin datos aún" aparece en el reporte24h card
        const reportes = screen.getByTestId("kpi-reportes-ltimas-24-h");
        expect(reportes.textContent).toContain("sin datos aún");
    });

    it("uptime.piApp con ok=false muestra chip rojo con mensaje de error", async () => {
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
            new Response(
                JSON.stringify(
                    mockKpis({
                        kpis: {
                            ...mockKpis().kpis,
                            uptime: {
                                biNext: { ok: true, latMs: 0 },
                                biVanna: { ok: true, latMs: 120 },
                                piApp: { ok: false, latMs: null, error: "timeout" },
                            },
                        },
                    }),
                ),
                { status: 200 },
            ),
        );
        render(<KpisDashboardHome />);
        await waitFor(() =>
            expect(screen.queryByTestId("kpis-grid")).toBeTruthy(),
        );
        const piApp = screen.getByTestId("uptime-piApp");
        expect(piApp.textContent).toContain("timeout");
    });
});
