import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PadreSideNav } from "./PadreSideNav";

const mockPathname = { value: "/dashboard/padre" };

vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname.value,
}));

vi.mock("next/link", () => ({
    default: ({ children, href, className, ...rest }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className} {...rest}>
            {children}
        </a>
    ),
}));

describe("PadreSideNav (SPEC-231)", () => {
    it("renderiza los 7 items del menú padre", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const labels = ["Inicio", "Mis expedientes", "Reportar", "Suscripción", "Círculo confianza", "Notificaciones", "Mi perfil"];
        for (const label of labels) {
            expect(screen.getByRole("link", { name: label })).toBeDefined();
        }
        expect(screen.getAllByRole("link")).toHaveLength(7);
    });

    it("marca Inicio como activo en la raíz", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const inicio = screen.getByRole("link", { name: "Inicio" });
        expect(inicio.getAttribute("aria-current")).toBe("page");
        expect(inicio.className).toContain("bg-sky-600");
    });

    it("marca Mis expedientes como activo en subruta", () => {
        mockPathname.value = "/dashboard/padre/expedientes";
        render(<PadreSideNav />);

        const expedientes = screen.getByRole("link", { name: "Mis expedientes" });
        expect(expedientes.getAttribute("aria-current")).toBe("page");
        const inicio = screen.getByRole("link", { name: "Inicio" });
        expect(inicio.getAttribute("aria-current")).toBeNull();
    });

    it("marca Suscripción como activo en su ruta", () => {
        mockPathname.value = "/dashboard/padre/suscripcion";
        render(<PadreSideNav />);

        const suscripcion = screen.getByRole("link", { name: "Suscripción" });
        expect(suscripcion.getAttribute("aria-current")).toBe("page");
        expect(suscripcion.getAttribute("href")).toBe("/dashboard/padre/suscripcion");
    });

    it("aplica clases de color cielo al sidebar", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const nav = screen.getByRole("navigation");
        expect(nav.className).toContain("border-sky-200/40");
        expect(nav.className).toContain("bg-sky-50/50");
    });
});
