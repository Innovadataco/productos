import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SeguimientoClient } from "./SeguimientoClient";

vi.mock("next/navigation", () => ({
    useSearchParams: () => ({ get: vi.fn(() => "") }),
}));

vi.mock("next/link", () => ({
    default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

function mockFetch(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

const baseData = {
    numeroSeguimiento: "RPT-ABC123",
    estadoVisual: "Verificado",
    estadoInterno: "CLASIFICADO",
    badge: "success",
    enProceso: false,
    creadoEn: "2026-07-18T10:00:00Z",
    actualizadoEn: "2026-07-18T10:05:00Z",
    mensaje: "Tu reporte ha sido procesado y clasificado.",
    slaHoras: 24,
    identificador: "30009000002",
    plataforma: "WhatsApp",
    clasificacion: {
        categoria: "SOLICITUD_MATERIAL",
        categoriaLabel: "Solicitud de material",
        categoriaGrupo: "Contacto sexual",
        contienePii: true,
        piiDetectada: ["nombre", "telefono"],
    },
    ranking: {
        score: 72,
        nivelRiesgo: "ALTO",
        totalReportes: 5,
        reportesAutenticados: 3,
        reportesAnonimos: 2,
    },
};

describe("SeguimientoClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra el estado simplificado, la clasificación y el riesgo con buen contraste", async () => {
        mockFetch(baseData);
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Verificado");
            expect(body).toContain("Tu reporte ha sido procesado y clasificado.");
            expect(body).toContain("Categoría del reporte");
            expect(body).toContain("Contacto sexual");
            expect(body).toContain("Nivel de riesgo del identificador");
            expect(body).toContain("72");
            expect(body).toContain("Riesgo ALTO");
            expect(body).toContain("El texto fue anonimizado");
        });
    });

    it("muestra 'En proceso' cuando el reporte aún no está clasificado", async () => {
        mockFetch({
            ...baseData,
            estadoVisual: "En proceso",
            estadoInterno: "REVISION_MANUAL",
            badge: "warning",
            enProceso: true,
            mensaje: "Tu reporte está en proceso — puede tardar hasta 24 horas",
            clasificacion: null,
        });
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-XYZ789" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("En proceso");
            expect(body).toContain("puede tardar hasta 24 horas");
            expect(body).not.toContain("Clasificación del reporte");
            expect(body).not.toContain("Contacto sexual");
        });
    });

    it("muestra error cuando el reporte no existe", async () => {
        mockFetch({ error: { message: "Reporte no encontrado" } }, false);
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-NOEXIST" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Reporte no encontrado");
        });
    });
});
