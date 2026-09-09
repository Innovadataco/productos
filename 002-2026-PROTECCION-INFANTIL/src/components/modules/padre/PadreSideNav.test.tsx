import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

/**
 * SPEC-607 · menú definitivo del padre (diseño aprobado,
 * design/expediente-final-mockup.html): 6 entradas — Inicio, A quién protejo,
 * A quién vigilo, Reportar (grupo), Ayuda profesional (grupo), Mi perfil.
 */
describe("PadreSideNav (SPEC-607)", () => {
    it("renderiza las 6 entradas del menú definitivo, con los 4 submódulos", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        // Ítems navegables de primer nivel.
        expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("href")).toBe("/dashboard/padre");
        expect(screen.getByRole("link", { name: "A quién protejo" }).getAttribute("href")).toBe("/dashboard/padre/hijos");
        expect(screen.getByRole("link", { name: "A quién vigilo" }).getAttribute("href")).toBe("/dashboard/padre/circulo-confianza");
        expect(screen.getByRole("link", { name: "Mi perfil" }).getAttribute("href")).toBe("/dashboard/padre/perfil");

        // Grupos (botón con chevron, no son enlaces).
        expect(screen.getByRole("button", { name: /Reportar/ })).toBeDefined();
        expect(screen.getByRole("button", { name: /Ayuda profesional/ })).toBeDefined();

        // Submódulos: los grupos nacen expandidos.
        const reportar = screen.getAllByRole("link", { name: "Reportar" });
        expect(reportar).toHaveLength(1);
        expect(reportar[0]!.getAttribute("href")).toBe("/dashboard/padre/reportar");
        expect(screen.getByRole("link", { name: "Mis expedientes" }).getAttribute("href")).toBe("/dashboard/padre/expedientes");
        expect(screen.getByRole("link", { name: "Encontrar psicólogo" }).getAttribute("href")).toBe("/dashboard/padre/profesionales");
        expect(screen.getByRole("link", { name: "Mis citas" }).getAttribute("href")).toBe("/dashboard/padre/citas");

        // Total: 4 de primer nivel + 4 submódulos.
        expect(screen.getAllByRole("link")).toHaveLength(8);
    });

    it("los ítems retirados ya NO están: Mis reportes, Suscripción y Notificaciones sueltos", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        expect(screen.queryByRole("link", { name: "Mis reportes" })).toBeNull();
        expect(screen.queryByRole("link", { name: "Suscripción" })).toBeNull();
        expect(screen.queryByRole("link", { name: "Notificaciones" })).toBeNull();
    });

    it("el chevron colapsa y expande el grupo (aria-expanded)", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const boton = screen.getByRole("button", { name: /Reportar/ });
        expect(boton.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByRole("link", { name: "Mis expedientes" })).toBeDefined();

        fireEvent.click(boton);
        expect(boton.getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByRole("link", { name: "Mis expedientes" })).toBeNull();
        // El otro grupo no se toca.
        expect(screen.getByRole("link", { name: "Mis citas" })).toBeDefined();

        fireEvent.click(boton);
        expect(boton.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getByRole("link", { name: "Mis expedientes" })).toBeDefined();
    });

    it("marca Inicio como activo en la raíz", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const inicio = screen.getByRole("link", { name: "Inicio" });
        expect(inicio.getAttribute("aria-current")).toBe("page");
        expect(inicio.className).toContain("bg-cielo");
    });

    it("marca Mis expedientes activo en subruta y NO marca Inicio", () => {
        mockPathname.value = "/dashboard/padre/expedientes/EXP-1";
        render(<PadreSideNav />);

        const expedientes = screen.getByRole("link", { name: "Mis expedientes" });
        expect(expedientes.getAttribute("aria-current")).toBe("page");
        expect(screen.getByRole("link", { name: "Inicio" }).getAttribute("aria-current")).toBeNull();
    });

    it("el grupo del destino activo se pinta en cielo aunque el padre no sea enlace", () => {
        mockPathname.value = "/dashboard/padre/citas";
        render(<PadreSideNav />);

        const ayuda = screen.getByRole("button", { name: /Ayuda profesional/ });
        expect(ayuda.className).toContain("text-cielo");
        expect(screen.getByRole("link", { name: "Mis citas" }).getAttribute("aria-current")).toBe("page");
    });

    it("aplica clases de color cielo al sidebar", () => {
        mockPathname.value = "/dashboard/padre";
        render(<PadreSideNav />);

        const nav = screen.getByRole("navigation");
        expect(nav.className).toContain("border-cielo/20");
        expect(nav.className).toContain("bg-cielo/5");
    });
});
