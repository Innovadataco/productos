import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ComiteSolicitudDetalle } from "./ComiteSolicitudDetalle";

const baseSolicitud = {
    id: "s1",
    numero: "SOL-001",
    reporteId: "r1",
    estado: "ASIGNADA" as const,
    motivo: "Motivo de prueba",
    creadoEn: new Date().toISOString(),
    comiteId: "comite-1",
};

const baseReporte = {
    id: "r1",
    identificador: "+573001234567",
    numeroSeguimiento: "RPT-001",
    estado: "REVISION_MANUAL",
    texto: "Texto de prueba",
    esAnonimo: false,
    prioridadAlta: false,
    keywordsDetectadas: [],
    esRafaga: false,
    creadoEn: new Date().toISOString(),
    fechaIncidente: new Date().toISOString(),
    ciudad: "Bogotá",
    pais: "Colombia",
    plataforma: { nombre: "WhatsApp", clave: "whatsapp" },
    clasificacion: {
        categoria: "SOLICITUD_ENCUENTRO",
        confianza: 0.85,
        modeloUsado: "test",
        posibleAgresorPar: false,
        categoriasSecundarias: [],
    },
};

function mockFetchDetalle(response: unknown, ok = true) {
    return vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes("/api/admin/reportes-revision/")) {
            return Promise.resolve({ ok, status: ok ? 200 : 500, json: async () => response } as Response);
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
    });
}

describe("ComiteSolicitudDetalle", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("no muestra opciones Clasificar/Corregir y tiene un solo botón Resolver", async () => {
        mockFetchDetalle({ reporte: baseReporte });
        render(<ComiteSolicitudDetalle solicitud={baseSolicitud} onClose={vi.fn()} onRefresh={vi.fn()} />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Resolver");
        });

        expect(document.body.textContent).not.toContain("Clasificar");
        expect(document.body.textContent).not.toContain("Corregir");
    });

    it("envía categoría y resolución al resolver", async () => {
        const fetchSpy = mockFetchDetalle({ reporte: baseReporte });
        render(<ComiteSolicitudDetalle solicitud={baseSolicitud} onClose={vi.fn()} onRefresh={vi.fn()} />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("Resolver");
        });

        const select = screen.getByLabelText("Categoría final") as HTMLSelectElement;
        fireEvent.change(select, { target: { value: "OFRECIMIENTO_REGALOS" } });

        const textarea = screen.getByLabelText("Motivo / resolución (opcional)") as HTMLTextAreaElement;
        fireEvent.change(textarea, { target: { value: "Revisado por comité" } });

        screen.getByText("Resolver").click();

        await waitFor(() => {
            const resolverCall = fetchSpy.mock.calls.find((c) => c[0].toString().includes("/resolver"));
            expect(resolverCall).toBeDefined();
        });

        const resolverCall = fetchSpy.mock.calls.find((c) => c[0].toString().includes("/resolver"));
        const body = JSON.parse((resolverCall?.[1] as RequestInit)?.body as string);
        expect(body.categoria).toBe("OFRECIMIENTO_REGALOS");
        expect(body.resolucion).toBe("Revisado por comité");
        expect(body.accion).toBeUndefined();
    });

    it("modo solo lectura no muestra formulario de resolución", async () => {
        mockFetchDetalle({ reporte: baseReporte });
        render(<ComiteSolicitudDetalle solicitud={{ ...baseSolicitud, estado: "RESUELTA" }} onClose={vi.fn()} onRefresh={vi.fn()} readOnly />);

        await waitFor(() => {
            expect(document.body.textContent).toContain("solo lectura");
        });

        expect(document.body.textContent).not.toContain("Resolver");
    });
});
