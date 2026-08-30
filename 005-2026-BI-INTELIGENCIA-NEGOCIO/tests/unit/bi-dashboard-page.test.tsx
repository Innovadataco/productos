import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardHomePage from "@/app/dashboard/page";

describe("DashboardHomePage", () => {
    it("renderiza título 'Home BI' y placeholder documentando qué falta", () => {
        render(<DashboardHomePage />);
        expect(screen.queryByText("Home BI")).toBeTruthy();
        expect(screen.queryByText(/Contenido pendiente/)).toBeTruthy();
        expect(screen.queryByText(/SPEC-025/)).toBeTruthy();
        expect(screen.queryByText(/SPEC-027/)).toBeTruthy();
        expect(screen.queryByText(/SPEC-028/)).toBeTruthy();
    });
});
