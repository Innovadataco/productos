import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HomePageClient, RPT_STORAGE_KEY } from "./HomePageClient";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush }),
    usePathname: () => "/",
    useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/modules/LandingHero", () => ({
    LandingHero: () => <div data-testid="landing-hero" />,
}));
vi.mock("@/components/modules/CanalesOficiales", () => ({
    CanalesOficiales: () => <div />,
}));
vi.mock("@/components/modules/LandingFooter", () => ({
    LandingFooter: () => <div />,
}));

describe("HomePageClient — campo RPT (spec 091-US2)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    it("ofrece el campo 'Consultar el estado de mi reporte'", () => {
        render(<HomePageClient />);
        expect(screen.getByLabelText("Número de seguimiento de mi reporte")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Ver estado de mi reporte" })).toBeTruthy();
    });

    it("transporta el RPT por sessionStorage y navega a /seguimiento SIN query string", () => {
        render(<HomePageClient />);

        fireEvent.change(screen.getByLabelText("Número de seguimiento de mi reporte"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Ver estado de mi reporte" }));

        expect(sessionStorage.getItem(RPT_STORAGE_KEY)).toBe("RPT-ABC123");
        expect(mockPush).toHaveBeenCalledWith("/seguimiento");
        // La navegación NO lleva el número en la URL
        expect(mockPush.mock.calls[0][0]).not.toContain("RPT-ABC123");
    });

    it("no navega con el campo vacío", () => {
        render(<HomePageClient />);
        fireEvent.click(screen.getByRole("button", { name: "Ver estado de mi reporte" }));
        expect(mockPush).not.toHaveBeenCalled();
        expect(sessionStorage.getItem(RPT_STORAGE_KEY)).toBeNull();
    });
});
