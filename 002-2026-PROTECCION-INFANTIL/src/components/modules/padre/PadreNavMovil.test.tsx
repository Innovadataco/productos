/**
 * SPEC-339 (T059) — la barra móvil del padre: todos los destinos presentes
 * (Reportar incluido — precedente I-38) y el activo marcado.
 *
 * SPEC-607: los grupos colapsables del lateral se aplastan acá — cada destino
 * queda a un toque. La lista esperada es el aplanado de PADRE_NAV_ITEMS.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PADRE_NAV_ITEMS } from "@/lib/nav-items";
import { PadreNavMovil } from "./PadreNavMovil";

const mockPathname = vi.hoisted(() => ({ value: "/dashboard/padre" }));
vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname.value,
}));

const DESTINOS_ESPERADOS = PADRE_NAV_ITEMS.flatMap((item) => item.children ?? [item]);

describe("PadreNavMovil (SPEC-339 · SPEC-607)", () => {
    it("muestra TODOS los destinos del aplanado de PADRE_NAV_ITEMS — sin lista paralela", () => {
        render(<PadreNavMovil />);
        for (const item of DESTINOS_ESPERADOS) {
            const link = screen.getByRole("link", { name: item.label });
            expect(link.getAttribute("href")).toBe(item.href);
        }
        expect(screen.getAllByRole("link")).toHaveLength(DESTINOS_ESPERADOS.length);
    });

    it("el aplanado son los 8 destinos del menú definitivo (SPEC-607)", () => {
        render(<PadreNavMovil />);
        const rotulos = screen.getAllByRole("link").map((a) => a.textContent);
        expect(rotulos).toEqual([
            "Inicio",
            "A quién protejo",
            "A quién vigilo",
            "Reportar",
            "Mis expedientes",
            "Encontrar psicólogo",
            "Mis citas",
            "Mi perfil",
        ]);
    });

    it("«Reportar» está a UN toque — proteger a un menor va por encima del cobro (I-38)", () => {
        render(<PadreNavMovil />);
        const reportar = screen.getByRole("link", { name: "Reportar" });
        expect(reportar.getAttribute("href")).toBe("/dashboard/padre/reportar");
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
