import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { AdminReporteDetalle } from "./AdminReporteDetalle";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn() }),
}));

function mockFetchDetalle(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        json: async () => response,
    } as Response);
}

function baseReporte(estado: string, correccion: unknown = null) {
    return {
        id: "reporte-123",
        identificador: "+573001234567",
        plataforma: { nombre: "WhatsApp", clave: "whatsapp" },
        texto: "Texto de prueba anonimizado",
        estado,
        ciudad: "Bogotá",
        pais: "Colombia",
        fechaIncidente: "2026-07-10T10:00:00Z",
        esAnonimo: false,
        numeroSeguimiento: "RPT-TEST001",
        creadoEn: "2026-07-10T10:00:00Z",
        prioridadAlta: false,
        keywordsDetectadas: [],
        esRafaga: false,
        eliminado: false,
        motivoBaja: null,
        notaBaja: null,
        eliminadoEn: null,
        clasificacion: {
            categoria: "OFRECIMIENTO_REGALOS",
            confianza: 0.85,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1000,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            correccion,
        },
    };
}

describe("AdminReporteDetalle - corrección de clasificación", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra el botón de corregir clasificación cuando el reporte es corregible", async () => {
        mockFetchDetalle({
            reporte: baseReporte("REVISION_MANUAL"),
            puedeRevelarOriginal: false,
            puedeEscalar: true,
        });

        render(
            <AdminReporteDetalle
                reporteId="reporte-123"
                onClose={vi.fn()}
                onRefresh={vi.fn()}
            />
        );

        await waitFor(() => {
            const body = document.body.textContent || "";
            expect(body).toContain("Corregir clasificación");
            expect(screen.getByTestId("select-correccion-categoria")).toBeTruthy();
        });
    });

    it("no muestra el botón de corregir cuando el reporte ya está CORREGIDO", async () => {
        mockFetchDetalle({
            reporte: baseReporte("CORREGIDO", {
                categoriaOriginal: "OFRECIMIENTO_REGALOS",
                categoriaCorregida: "SOLICITUD_ENCUENTRO",
                motivo: "Corrección de prueba",
                creadoEn: "2026-07-10T11:00:00Z",
            }),
            puedeRevelarOriginal: false,
            puedeEscalar: false,
        });

        render(
            <AdminReporteDetalle
                reporteId="reporte-123"
                onClose={vi.fn()}
                onRefresh={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId("select-correccion-categoria")).toBeNull();
        });
    });

    it("no muestra el botón de corregir cuando el reporte no tiene clasificación", async () => {
        const data = baseReporte("REVISION_MANUAL");
        (data as { clasificacion: unknown }).clasificacion = null;

        mockFetchDetalle({
            reporte: data,
            puedeRevelarOriginal: false,
            puedeEscalar: true,
        });

        render(
            <AdminReporteDetalle
                reporteId="reporte-123"
                onClose={vi.fn()}
                onRefresh={vi.fn()}
            />
        );

        await waitFor(() => {
            expect(screen.queryByTestId("select-correccion-categoria")).toBeNull();
        });
    });
});
