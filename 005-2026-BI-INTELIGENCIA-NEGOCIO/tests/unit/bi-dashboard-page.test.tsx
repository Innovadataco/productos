import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardHomePage from "@/app/dashboard/page";

const fetchOrig = global.fetch;
beforeEach(() => {
    // El componente KpisDashboardHome hace fetch al montar. Sin resolverlo
    // aquí, el test solo comprueba render inicial (loading state incluido).
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {}));
});
afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = fetchOrig;
});

describe("DashboardHomePage", () => {
    it("renderiza título 'Home BI' y el widget de KPIs (SPEC-025 lo pobló)", () => {
        render(<DashboardHomePage />);
        expect(screen.queryByText("Home BI")).toBeTruthy();
        // KpisDashboardHome muestra loading mientras el fetch no resuelve
        expect(screen.queryByTestId("kpis-loading")).toBeTruthy();
    });
});
