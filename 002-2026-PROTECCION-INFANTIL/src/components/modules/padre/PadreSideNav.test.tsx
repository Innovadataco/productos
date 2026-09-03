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
    // SPEC-317: "Mi perfil" se retiró de PADRE_NAV_ITEMS porque /dashboard/padre/perfil
    // no existe todavía — la página de perfil del padre es deuda pendiente. El ítem se
    // quita del menú lateral para no generar un enlace roto; cuando la página exista,
    // se reincorpora aquí y en nav-items.ts.
    it("renderiza los 9 items del menú padre (Mi perfil retirado por SPEC-317; Mis reportes agregado por SPEC-324; Encontrar psicólogo agregado por SPEC-392)", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const labels = ["Inicio", "Mis expedientes", "Mis reportes", "Reportar", "Encontrar psicólogo", "Suscripción", "A quién protejo", "A quién vigilo", "Notificaciones"]; // SPEC-324 + SPEC-325 + SPEC-392
        for (const label of labels) {
            expect(screen.getByRole("link", { name: label })).toBeDefined();
        }
        expect(screen.queryByRole("link", { name: "Mi perfil" })).toBeNull();
        // SPEC-324: "Mis reportes" apunta a la ruta top-level /mis-reportes (fuera del shell).
        expect(screen.getByRole("link", { name: "Mis reportes" }).getAttribute("href")).toBe("/mis-reportes");
        // SPEC-392 (L3): "Encontrar psicólogo" al directorio del padre.
        expect(screen.getByRole("link", { name: "Encontrar psicólogo" }).getAttribute("href")).toBe("/dashboard/padre/profesionales");
        expect(screen.getAllByRole("link")).toHaveLength(9);
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
