/**
 * SPEC-149 (T005, US4, FR-007) — Pantalla de configuración de avisos: render de
 * los 4 tipos con la terminología §3 ("avisos", "te avisamos", cero jerga),
 * toggle, email destino y umbrales; PATCH por tipo con mensaje humano.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ConfiguracionPageClient from "./ConfiguracionPageClient";

const ITEMS = [
    { tipoEvento: "REPORTE_NUEVO", habilitado: true, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: null, ventanaDias: null },
    { tipoEvento: "UMBRAL_CURSO", habilitado: true, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: 3, ventanaDias: 7 },
    { tipoEvento: "ESTUDIANTE_REPETIDO", habilitado: false, emailDestino: "rectoria@colegio.edu.co", emailEfectivo: "rectoria@colegio.edu.co", umbral: 2, ventanaDias: 30 },
    { tipoEvento: "RESUMEN_SEMANAL", habilitado: true, emailDestino: null, emailEfectivo: "rector@colegio.edu.co", umbral: null, ventanaDias: null },
];

function mockFetchGet(items: unknown[] = ITEMS) {
    const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ items, emailPorDefecto: "rector@colegio.edu.co" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("ConfiguracionPageClient", () => {
    it("pinta los 4 tipos de aviso con la terminología §3 y cero jerga", async () => {
        mockFetchGet();
        render(<ConfiguracionPageClient />);

        expect(await screen.findByText("Reporte nuevo")).toBeTruthy();
        expect(screen.getByText("Umbral por curso")).toBeTruthy();
        expect(screen.getByText("Estudiante con reportes repetidos")).toBeTruthy();
        expect(screen.getByText("Resumen del lunes")).toBeTruthy();
        expect(screen.getAllByText(/Te avisamos/).length).toBeGreaterThan(0);

        // Cero jerga técnica en la pantalla.
        const texto = document.body.textContent || "";
        for (const jerga of ["idempotencia", "digest", "cola", "notificación"]) {
            expect(texto.toLowerCase()).not.toContain(jerga);
        }
    });

    it("refleja el estado de cada aviso (Activado/Desactivado) y los umbrales", async () => {
        mockFetchGet();
        render(<ConfiguracionPageClient />);
        await screen.findByText("Reporte nuevo");

        expect(screen.getAllByRole("button", { name: "Activado" })).toHaveLength(3);
        expect(screen.getAllByRole("button", { name: "Desactivado" })).toHaveLength(1);
        expect(screen.getByDisplayValue("3")).toBeTruthy();
        expect(screen.getByDisplayValue("30")).toBeTruthy();
        expect(screen.getByDisplayValue("rectoria@colegio.edu.co")).toBeTruthy();
    });

    it("guardar hace PATCH por tipo con toggle, email y umbrales", async () => {
        const fetchMock = mockFetchGet();
        render(<ConfiguracionPageClient />);
        await screen.findByText("Umbral por curso");

        // Desactiva el aviso de umbral y ajusta el umbral.
        const card = screen.getByText("Umbral por curso").closest("div[class*='glass']")!;
        fireEvent.click(screen.getAllByRole("button", { name: "Activado" })[1]!);
        fireEvent.change(screen.getByDisplayValue("3"), { target: { value: "5" } });
        fireEvent.click(card.querySelectorAll("button")[card.querySelectorAll("button").length - 1]!);

        await waitFor(() => {
            const patch = fetchMock.mock.calls.find((c) => c[1]?.method === "PATCH");
            expect(patch).toBeTruthy();
            const body = JSON.parse(String(patch![1]!.body));
            expect(body).toMatchObject({ tipoEvento: "UMBRAL_CURSO", habilitado: false, umbral: 5, ventanaDias: 7 });
        });
        expect(await screen.findByText(/guardado/)).toBeTruthy();
    });

    it("muestra el mensaje humano del endpoint cuando el PATCH falla (400)", async () => {
        const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
            if (init?.method === "PATCH") {
                return { ok: false, status: 400, json: async () => ({ error: { message: "El umbral máximo es 100" } }) };
            }
            return { ok: true, status: 200, json: async () => ({ items: ITEMS, emailPorDefecto: "rector@colegio.edu.co" }) };
        });
        vi.stubGlobal("fetch", fetchMock);
        render(<ConfiguracionPageClient />);
        await screen.findByText("Reporte nuevo");

        fireEvent.click(screen.getAllByRole("button", { name: "Guardar" })[0]!);
        expect(await screen.findByText("El umbral máximo es 100")).toBeTruthy();
    });

    it("error de carga muestra ErrorState con reintento", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
        render(<ConfiguracionPageClient />);
        expect(await screen.findByText("No pudimos cargar la configuración")).toBeTruthy();
    });
});
