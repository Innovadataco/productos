import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConsultaEnriquecidaClient } from "./ConsultaEnriquecidaClient";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("./MapaUbicaciones", () => ({
    MapaUbicaciones: ({ puntos }: { puntos: { label: string }[] }) => (
        <div data-testid="mapa">{puntos.map((p) => p.label).join("; ")}</div>
    ),
}));

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

const detalleConReportes = {
    identificador: "3001111111",
    tieneReportes: true,
    nivelRiesgo: "ALTO",
    confianzaPromedio: 0.91,
    totalReportes: 2,
    reportesAutenticados: 1,
    reportesAnonimos: 1,
    ultimoReporte: "2026-07-16T15:55:26.045Z",
    plataformas: [{ id: "p1", nombre: "WhatsApp", clave: "whatsapp", total: 2, otraPlataforma: null }],
    resumenPlataformas: "2 reportes en WhatsApp",
    reportes: [
        {
            id: "r1",
            plataforma: "WhatsApp",
            esAnonimo: false,
            fecha: "2026-07-16",
            categoria: "SOLICITUD_MATERIAL",
            categoriaLabel: "Solicitud de material",
            categoriaGrupo: "Contacto sexual",
            confianza: 0.9,
            nivelRiesgo: "ALTO",
        },
        {
            id: "r2",
            plataforma: "WhatsApp",
            esAnonimo: true,
            fecha: "2026-07-15",
            categoria: "CONTACTO_INSISTENTE",
            categoriaLabel: "Contacto insistente",
            categoriaGrupo: "Manipulación o engaño",
            confianza: 0.8,
            nivelRiesgo: "MEDIO",
        },
    ],
    ubicaciones: [
        { pais: "Colombia", ciudad: "Bogotá", total: 2, lat: 4.711, lng: -74.0721 },
    ],
};

describe("ConsultaEnriquecidaClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra detalle agregado, tabla de reportes y mapa sin coordenadas exactas", async () => {
        mockFetch(detalleConReportes);
        render(<ConsultaEnriquecidaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3001111111" },
        });
        fireEvent.click(screen.getByRole("button", { name: /buscar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Riesgo alto");
            expect(document.body.textContent).toContain("91%");
            expect(document.body.textContent).toContain("Contacto sexual");
            expect(document.body.textContent).toContain("Manipulación o engaño");
            expect(document.body.textContent).toContain("2 reportes en WhatsApp");
            expect(document.body.textContent).toContain("Bogotá");
            expect(document.body.textContent).toContain("Colombia");
        });

        const mapa = screen.getByTestId("mapa");
        expect(mapa.textContent).toContain("Bogotá, Colombia");

        // No expone texto del reporte ni identidad del denunciante
        expect(document.body.textContent).not.toContain("textoOriginal");
        expect(document.body.textContent).not.toContain("usuarioId");
        expect(document.body.textContent).not.toContain("4.711"); // coordenada exacta
        expect(document.body.textContent).not.toContain("-74.0721"); // coordenada exacta
    });

    it("muestra mensaje cuando no hay reportes", async () => {
        mockFetch({ identificador: "3000000000", tieneReportes: false, mensaje: "Sin reportes." });
        render(<ConsultaEnriquecidaClient />);

        fireEvent.change(screen.getByPlaceholderText("Ej: 3002222222 o @usuario"), {
            target: { value: "3000000000" },
        });
        fireEvent.click(screen.getByRole("button", { name: /buscar/i }));

        await waitFor(() => {
            expect(document.body.textContent).toContain("Sin reportes");
        });
    });
});
