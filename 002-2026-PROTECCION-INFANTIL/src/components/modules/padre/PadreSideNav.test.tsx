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
    // SPEC-440 P4 (Jelkin vivo 04-09): «el perfil del padre no deja editar sus datos».
    // La pantalla existe desde SPEC-334; SPEC-317 la había retirado del nav por
    // hueco temporal — reincorporada acá para que el padre pueda llegar a editarla.
    it("renderiza los 10 items del menú padre (SPEC-440 P4 reincorpora Mi perfil; Mis reportes y Encontrar psicólogo siguen)", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const labels = ["Inicio", "Mis expedientes", "Mis reportes", "Reportar", "Encontrar psicólogo", "Suscripción", "A quién protejo", "A quién vigilo", "Notificaciones", "Mi perfil"];
        for (const label of labels) {
            expect(screen.getByRole("link", { name: label })).toBeDefined();
        }
        expect(screen.getByRole("link", { name: "Mi perfil" }).getAttribute("href")).toBe("/dashboard/padre/perfil");
        // SPEC-324: "Mis reportes" apunta a la ruta top-level /mis-reportes (fuera del shell).
        expect(screen.getByRole("link", { name: "Mis reportes" }).getAttribute("href")).toBe("/mis-reportes");
        // SPEC-392 (L3): "Encontrar psicólogo" al directorio del padre.
        expect(screen.getByRole("link", { name: "Encontrar psicólogo" }).getAttribute("href")).toBe("/dashboard/padre/profesionales");
        expect(screen.getAllByRole("link")).toHaveLength(10);
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
