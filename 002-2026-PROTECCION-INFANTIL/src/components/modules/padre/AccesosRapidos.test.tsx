/**
 * SPEC-309 (A-50): tests unitarios de AccesosRapidos.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccesosRapidos } from "./AccesosRapidos";

describe("AccesosRapidos", () => {
    it("renderiza enlaces internos y externos", () => {
        render(
            <AccesosRapidos
                accesos={[
                    { label: "Reportar", href: "/dashboard/padre/reportar" },
                    { label: "Línea 141", href: "https://www.icbf.gov.co/linea-141", externo: true },
                ]}
            />
        );

        const reportar = screen.getByRole("link", { name: /Reportar/i });
        expect(reportar.getAttribute("href")).toBe("/dashboard/padre/reportar");
        expect(reportar.getAttribute("target")).toBeNull();

        const linea = screen.getByRole("link", { name: /Línea 141/i });
        expect(linea.getAttribute("href")).toBe("https://www.icbf.gov.co/linea-141");
        expect(linea.getAttribute("target")).toBe("_blank");
        expect(linea.getAttribute("rel")).toBe("noopener noreferrer");
    });

    it("muestra el título de la sección", () => {
        render(<AccesosRapidos accesos={[]} />);
        expect(screen.getByText(/Accesos rápidos/i)).toBeTruthy();
    });
});
