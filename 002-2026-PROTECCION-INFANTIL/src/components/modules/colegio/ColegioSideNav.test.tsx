import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ColegioSideNav } from "./ColegioSideNav";

const mockPathname = { value: "/dashboard/colegio" };

vi.mock("next/navigation", () => ({
    usePathname: () => mockPathname.value,
}));

vi.mock("next/link", () => ({
    default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

const MODULOS_RECTOR = ["colegios", "colegios_gestion", "colegios_comite", "colegios_comite_bandeja", "colegios_auditoria"];

describe("ColegioSideNav (SPEC-173, FASE-C)", () => {
    it("el rector ve los 8 ítems, con Usuarios como nodo padre (botón, no enlace)", () => {
        mockPathname.value = "/dashboard/colegio";
        render(<ColegioSideNav rol="SCHOOL_ADMIN" modulosPermitidos={MODULOS_RECTOR} />);

        // 7 enlaces directos + el nodo padre expandible.
        for (const label of ["Inicio", "Estadísticas", "Alertas", "Cursos", "Casos comité", "Configuración", "Auditoría"]) {
            expect(screen.getByRole("link", { name: label })).toBeDefined();
        }
        const usuarios = screen.getByRole("button", { name: /Usuarios/ });
        expect(usuarios.getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByRole("link", { name: /Usuarios/ })).toBeNull();
    });

    it("Usuarios se auto-expande cuando la ruta activa es un hijo (integrantes)", () => {
        mockPathname.value = "/dashboard/colegio/comite/integrantes";
        render(<ColegioSideNav rol="SCHOOL_ADMIN" modulosPermitidos={MODULOS_RECTOR} />);

        expect(screen.getByRole("button", { name: /Usuarios/ }).getAttribute("aria-expanded")).toBe("true");
        const profesores = screen.getByRole("link", { name: "Profesores" });
        expect(profesores.getAttribute("href")).toBe("/dashboard/colegio/profesores");
        const integrantes = screen.getByRole("link", { name: "Comité de convivencia" });
        expect(integrantes.getAttribute("href")).toBe("/dashboard/colegio/comite/integrantes");
    });

    it("Usuarios se auto-expande también en la ruta de profesores", () => {
        mockPathname.value = "/dashboard/colegio/profesores";
        render(<ColegioSideNav rol="SCHOOL_ADMIN" modulosPermitidos={MODULOS_RECTOR} />);

        expect(screen.getByRole("button", { name: /Usuarios/ }).getAttribute("aria-expanded")).toBe("true");
    });

    it("el comité de convivencia ve solo sus 3 ítems", () => {
        mockPathname.value = "/dashboard/colegio/comite";
        render(<ColegioSideNav rol="COMITE_CONVIVENCIA" modulosPermitidos={["colegios_comite_bandeja"]} />);

        const links = screen.getAllByRole("link");
        expect(links).toHaveLength(3);
        // SPEC-319 §2.5: etiqueta única "Gestión de casos" (antes "Gestión casos").
        expect(links.map((l) => l.textContent)).toEqual(["Inicio", "Estadísticas", "Gestión de casos"]);
        expect(links[0].getAttribute("href")).toBe("/dashboard/colegio/comite");
        expect(links[1].getAttribute("href")).toBe("/dashboard/colegio/comite/estadisticas");
        expect(links[2].getAttribute("href")).toBe("/dashboard/colegio/comite/casos");
        expect(screen.queryByRole("button")).toBeNull();
    });

    it("Onboarding, Materias y Subir lista ya no aparecen en el menú", () => {
        mockPathname.value = "/dashboard/colegio";
        render(<ColegioSideNav rol="SCHOOL_ADMIN" modulosPermitidos={[...MODULOS_RECTOR, "colegios_onboarding"]} />);

        expect(screen.queryByText("Onboarding")).toBeNull();
        expect(screen.queryByText("Materias")).toBeNull();
        expect(screen.queryByText("Subir lista")).toBeNull();
    });
});
