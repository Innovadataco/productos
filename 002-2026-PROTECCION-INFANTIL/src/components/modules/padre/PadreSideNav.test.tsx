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
    it("renderiza los 11 items del menú padre (SPEC-545 agrega «Mis citas» tras «Encontrar psicólogo»; SPEC-440 P4 Mi perfil)", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const labels = ["Inicio", "Mis expedientes", "Mis reportes", "Reportar", "Encontrar psicólogo", "Mis citas", "Suscripción", "A quién protejo", "A quién vigilo", "Notificaciones", "Mi perfil"];
        for (const label of labels) {
            expect(screen.getByRole("link", { name: label })).toBeDefined();
        }
        expect(screen.getByRole("link", { name: "Mi perfil" }).getAttribute("href")).toBe("/dashboard/padre/perfil");
        // SPEC-324: "Mis reportes" apunta a la ruta top-level /mis-reportes (fuera del shell).
        expect(screen.getByRole("link", { name: "Mis reportes" }).getAttribute("href")).toBe("/mis-reportes");
        // SPEC-392 (L3): "Encontrar psicólogo" al directorio del padre.
        expect(screen.getByRole("link", { name: "Encontrar psicólogo" }).getAttribute("href")).toBe("/dashboard/padre/profesionales");
        // SPEC-545: «Mis citas» va inmediatamente tras «Encontrar psicólogo».
        expect(screen.getByRole("link", { name: "Mis citas" }).getAttribute("href")).toBe("/dashboard/padre/citas");
        const rotulos = screen.getAllByRole("link").map((a) => a.textContent);
        expect(rotulos.indexOf("Mis citas")).toBe(rotulos.indexOf("Encontrar psicólogo") + 1);
        expect(screen.getAllByRole("link")).toHaveLength(11);
    });

    it("marca Inicio como activo en la raíz", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const inicio = screen.getByRole("link", { name: "Inicio" });
        expect(inicio.getAttribute("aria-current")).toBe("page");
        expect(inicio.className).toContain("bg-cielo");
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
        expect(nav.className).toContain("border-cielo/20");
        expect(nav.className).toContain("bg-cielo/5");
    });
});
