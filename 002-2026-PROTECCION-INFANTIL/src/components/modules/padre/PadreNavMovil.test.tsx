/**
 * SPEC-339 (T059) — la barra móvil del padre: todos los destinos presentes
 * (Reportar incluido — precedente I-38) y el activo marcado.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PADRE_NAV_ITEMS } from "@/lib/nav-items";
import { PadreNavMovil } from "./PadreNavMovil";

const mockPathname = vi.hoisted(() => ({ value: "/dashboard/padre" }));
vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname.value,
}));

describe("PadreNavMovil (SPEC-339)", () => {
    it("muestra TODOS los destinos de PADRE_NAV_ITEMS — sin lista paralela", () => {
        render(<PadreNavMovil />);
        for (const item of PADRE_NAV_ITEMS) {
            const link = screen.getByRole("link", { name: item.label });
            expect(link.getAttribute("href")).toBe(item.href);
        }
    });

    it("«Reportar» está — proteger a un menor va por encima del cobro (I-38)", () => {
        render(<PadreNavMovil />);
        expect(screen.getByRole("link", { name: "Reportar" })).toBeTruthy();
    });

    it("marca el destino activo con aria-current", () => {
        mockPathname.value = "/dashboard/padre/expedientes";
        render(<PadreNavMovil />);
        expect(
            screen.getByRole("link", { name: "Mis expedientes" }).getAttribute("aria-current")
        ).toBe("page");
        expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("aria-current")).toBeNull();
    });
});
