import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SpamAnaliticaPanel } from "./SpamAnaliticaPanel";
import type { Analitica } from "./types";

const analiticaBase: Analitica = {
    generadoEn: new Date().toISOString(),
    metricas: {
        7: { esSpam: 2, corregidos: 1, procesadosComoAcoso: 1, totalResueltos: 4, tasaSpam: 0.5, tiempoPromedioResolucionMin: 12 },
        30: { esSpam: 10, corregidos: 3, procesadosComoAcoso: 2, totalResueltos: 15, tasaSpam: 0.67, tiempoPromedioResolucionMin: 15 },
        90: { esSpam: 25, corregidos: 5, procesadosComoAcoso: 5, totalResueltos: 35, tasaSpam: 0.71, tiempoPromedioResolucionMin: null },
    },
    serie: [
        { fecha: "2026-08-20", esSpam: 1, corregidos: 0, procesadosComoAcoso: 0 },
        { fecha: "2026-08-21", esSpam: 0, corregidos: 1, procesadosComoAcoso: 1 },
    ],
    distribucion: {
        porPlataforma: [{ plataformaId: "p1", nombre: "WhatsApp", count: 3 }],
        porCategoria: [{ categoria: "CONTACTO_INSISTENTE", count: 2 }],
    },
    topIdentificadores: [{ identificador: "5551234", plataformaId: "p1", plataformaNombre: "WhatsApp", count: 3 }],
    topOperadores: [{ operadorId: "op1", nombre: "Ana", email: "ana@example.com", count: 2 }],
};

describe("SpamAnaliticaPanel", () => {
    it("renderiza encabezado, botones de ventana y botón de banco", () => {
        render(
            <SpamAnaliticaPanel
                analitica={null}
                loading={false}
                error=""
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={vi.fn()}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText("Panel de análisis")).toBeTruthy();
        expect(screen.getByRole("button", { name: "Sugerir al banco" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "7d" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "30d" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "90d" })).toBeTruthy();
    });

    it("muestra estado de carga", () => {
        render(
            <SpamAnaliticaPanel
                analitica={null}
                loading
                error=""
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={vi.fn()}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(document.querySelector("[role='status']") ?? document.querySelector(".animate-spin")).toBeTruthy();
    });

    it("muestra ErrorState cuando hay error", () => {
        render(
            <SpamAnaliticaPanel
                analitica={null}
                loading={false}
                error="fallo de red"
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={vi.fn()}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText("No pudimos cargar el análisis")).toBeTruthy();
        expect(screen.getByText("fallo de red")).toBeTruthy();
    });

    it("renderiza métricas y gráficos con datos completos", () => {
        render(
            <SpamAnaliticaPanel
                analitica={analiticaBase}
                loading={false}
                error=""
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={vi.fn()}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getByText("Confirmados spam", { selector: "p.text-sm" })).toBeTruthy();
        expect(screen.getByText("2", { selector: "p.text-2xl" })).toBeTruthy();
        expect(screen.getByText("Corregidos", { selector: "p.text-sm" })).toBeTruthy();
        expect(screen.getByText("Procesados como acoso", { selector: "p.text-sm" })).toBeTruthy();
        expect(screen.getByText("50.0%", { selector: "p.text-2xl" })).toBeTruthy();
        expect(screen.getByText("Ø 12 min")).toBeTruthy();
        expect(screen.getByText("Últimos 30 días")).toBeTruthy();
        expect(screen.getAllByText("WhatsApp").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText("Contacto insistente", { selector: "span" })).toBeTruthy();
        expect(screen.getByText("5551234")).toBeTruthy();
        expect(screen.getByText("Ana")).toBeTruthy();
    });

    it("cambia de ventana al hacer clic", () => {
        const onVentanaChange = vi.fn();
        render(
            <SpamAnaliticaPanel
                analitica={analiticaBase}
                loading={false}
                error=""
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={onVentanaChange}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "30d" }));
        expect(onVentanaChange).toHaveBeenCalledWith(30);
    });

    it("dispara sugerir al banco", () => {
        const onSugerirBanco = vi.fn();
        render(
            <SpamAnaliticaPanel
                analitica={analiticaBase}
                loading={false}
                error=""
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={vi.fn()}
                onSugerirBanco={onSugerirBanco}
                onRetry={vi.fn()}
            />
        );

        fireEvent.click(screen.getByRole("button", { name: "Sugerir al banco" }));
        expect(onSugerirBanco).toHaveBeenCalled();
    });

    it("muestra estado generando y deshabilita el botón", () => {
        render(
            <SpamAnaliticaPanel
                analitica={analiticaBase}
                loading={false}
                error=""
                ventanaActiva={7}
                descargandoBanco
                onVentanaChange={vi.fn()}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        const boton = screen.getByRole("button", { name: "Generando..." }) as HTMLButtonElement;
        expect(boton).toBeTruthy();
        expect(boton.disabled).toBe(true);
    });

    it("renderiza series vacías y distribuciones sin datos sin romper", () => {
        const analiticaVacia: Analitica = {
            generadoEn: new Date().toISOString(),
            metricas: {
                7: { esSpam: 0, corregidos: 0, procesadosComoAcoso: 0, totalResueltos: 0, tasaSpam: 0, tiempoPromedioResolucionMin: null },
                30: { esSpam: 0, corregidos: 0, procesadosComoAcoso: 0, totalResueltos: 0, tasaSpam: 0, tiempoPromedioResolucionMin: null },
                90: { esSpam: 0, corregidos: 0, procesadosComoAcoso: 0, totalResueltos: 0, tasaSpam: 0, tiempoPromedioResolucionMin: null },
            },
            serie: [],
            distribucion: { porPlataforma: [], porCategoria: [] },
            topIdentificadores: [],
            topOperadores: [],
        };

        render(
            <SpamAnaliticaPanel
                analitica={analiticaVacia}
                loading={false}
                error=""
                ventanaActiva={7}
                descargandoBanco={false}
                onVentanaChange={vi.fn()}
                onSugerirBanco={vi.fn()}
                onRetry={vi.fn()}
            />
        );

        expect(screen.getAllByText("Sin datos").length).toBeGreaterThanOrEqual(2);
    });
});
