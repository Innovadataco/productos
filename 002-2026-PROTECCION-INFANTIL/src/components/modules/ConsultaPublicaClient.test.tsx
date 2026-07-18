import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsultaPublicaClient } from "./ConsultaPublicaClient";

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

const baseConReportes = {
    identificador: "3001111111",
    tieneReportes: true,
    visibleEnDashboard: false,
    totalReportes: 1,
    reportesAutenticados: 0,
    reportesAnonimos: 1,
    primerReporte: "2026-07-16T15:55:26.045Z",
    ultimoReporte: "2026-07-16T15:55:26.045Z",
    plataformas: [{ id: "p1", nombre: "Facebook", clave: "facebook", total: 1 }],
    categorias: [{ categoria: "COMPARTIMIENTO_SEXUAL", total: 1, confianzaPromedio: 0.8 }],
    ubicaciones: [
        {
            pais: "Bolivia",
            ciudad: "Cochabamba",
            total: 1,
            fechasReporte: ["2026-07-16"],
            fechasIncidente: ["2026-07-16"],
        },
    ],
    timeline: [{ mes: "2026-07", total: 1 }],
    resumen:
        "Se han reportado 1 vez(es) entre 2026-07-16 y 2026-07-16 en 1 ciudad(es) de 1 país(es) y 1 plataforma(s).",
};

describe("ConsultaPublicaClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra mensaje claro cuando el identificador no tiene reportes", async () => {
        mockFetch({ identificador: "30009000000", tieneReportes: false, mensaje: "Sin reportes registrados." });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "30009000000" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Sin reportes registrados");
        });
    });

    it("muestra mensaje claro cuando el identificador no existe", async () => {
        mockFetch({
            identificador: "300999999999",
            tieneReportes: false,
            mensaje: "Sin reportes registrados.",
        });
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "300999999999" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Sin reportes registrados");
        });
    });

    it("renderiza correctamente cuando el identificador tiene reportes", async () => {
        mockFetch(baseConReportes);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Facebook");
            expect(document.body.textContent).toContain("Compartimiento sexual");
            expect(document.body.textContent).toContain("Total reportes");
        });
    });

    it("muestra error cuando la API falla", async () => {
        mockFetch({ error: { message: "Error del servidor" } }, false);
        render(<ConsultaPublicaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Error del servidor");
        });
    });
});
