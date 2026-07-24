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
    estadoVisual: "Procesado",
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
        categoriasSecundarias: ["CONTACTO_INSISTENTE"],
        contienePii: true,
        piiDetectada: ["nombre", "telefono"],
    },
    ranking: { totalReportes: 5, reportesAutenticados: 2, reportesAnonimos: 3 },
    actividad: "alta",
};

describe("SeguimientoClient", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra el estado simplificado, las conductas y el riesgo con buen contraste", async () => {
        mockFetch(baseData);
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Procesado");
            expect(body).toContain("Tu reporte ha sido procesado y clasificado.");
            expect(body).toContain("Gracias por reportar.");
            expect(body).toContain("Conductas identificadas");
            expect(body).toContain("Solicitud de material");
            expect(body).toContain("Contacto insistente");
            // spec 089-US6: sin score ni etiqueta de riesgo; señal descriptiva de actividad
            expect(body).toContain("Actividad del identificador");
            expect(body).toContain("Actividad alta de reportes");
            expect(body).not.toContain("Riesgo ALTO");
            expect(body).not.toContain("Nivel de riesgo del identificador");
            expect(body).toContain("El texto fue anonimizado");
        });
    });

    it("muestra todas las conductas ordenadas por gravedad (principal + secundarias)", async () => {
        mockFetch({
            ...baseData,
            clasificacion: {
                ...baseData.clasificacion,
                categoria: "CONTACTO_INSISTENTE",
                categoriasSecundarias: ["EXTORSION", "SOLICITUD_ENCUENTRO"],
            },
        });
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Solicitud de encuentro");
            expect(body).toContain("Extorsión");
            expect(body).toContain("Contacto insistente");
            const iEncuentro = body.indexOf("Solicitud de encuentro");
            const iExtorsion = body.indexOf("Extorsión");
            const iContacto = body.indexOf("Contacto insistente");
            expect(iEncuentro).toBeGreaterThan(-1);
            expect(iEncuentro).toBeLessThan(iExtorsion);
            expect(iExtorsion).toBeLessThan(iContacto);
        });
    });

    it.each(["SPAM", "OTRO"])("muestra 'No se identifica riesgo' cuando la única categoría es %s", async (categoria) => {
        mockFetch({
            ...baseData,
            clasificacion: {
                ...baseData.clasificacion,
                categoria,
                categoriasSecundarias: [],
            },
        });
        render(<SeguimientoClient />);

        fireEvent.change(screen.getByPlaceholderText("RPT-XXXXXX"), {
            target: { value: "RPT-ABC123" },
        });
        fireEvent.click(screen.getByRole("button", { name: /consultar/i }));

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("No se identifica riesgo");
            expect(body).not.toContain("SPAM");
            expect(body).not.toContain("Otro");
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
            expect(body).not.toContain("Conductas identificadas");
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
