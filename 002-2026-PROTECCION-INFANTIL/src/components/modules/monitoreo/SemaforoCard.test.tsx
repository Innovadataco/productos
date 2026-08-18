/**
 * SPEC-171 (T015) — Tests unitarios de SemaforoCard: estados, hints y
 * formato del último chequeo. Sin BD ni red.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SemaforoCard, SENALES_OPERACION, nombreSenal, type EstadoSemaforo } from "./SemaforoCard";

function renderSemaforo(estado: EstadoSemaforo, ultimoProbeEn: string | null = null) {
    return render(
        <SemaforoCard nombre="Cerebro IA" estado={estado} ultimoProbeEn={ultimoProbeEn} hint="El cerebro IA atiende" />
    );
}

describe("SemaforoCard", () => {
    it("verde: rótulo 'Operativo' con hint y nombre", () => {
        renderSemaforo("verde");
        expect(screen.getByText("Cerebro IA")).toBeTruthy();
        expect(screen.getByText("Operativo")).toBeTruthy();
        expect(screen.getByText("El cerebro IA atiende")).toBeTruthy();
        expect(screen.getByLabelText("Señal Cerebro IA: Operativo")).toBeTruthy();
    });

    it("rojo: rótulo 'Con problema'", () => {
        renderSemaforo("rojo");
        expect(screen.getByText("Con problema")).toBeTruthy();
    });

    it("amarillo: rótulo 'Con demora'", () => {
        renderSemaforo("amarillo");
        expect(screen.getByText("Con demora")).toBeTruthy();
    });

    it("no-aplica: rótulo 'No aplica'", () => {
        renderSemaforo("no-aplica");
        expect(screen.getByText("No aplica")).toBeTruthy();
    });

    it("sin probes: 'Sin chequeos aún'", () => {
        renderSemaforo("verde", null);
        expect(screen.getByText("Sin chequeos aún")).toBeTruthy();
    });

    it("con probe: muestra 'Último chequeo' con la fecha", () => {
        renderSemaforo("verde", "2026-08-18T05:00:00.000Z");
        expect(screen.getByText(/Último chequeo:/)).toBeTruthy();
    });

    it("fecha inválida no truena: cae en 'Sin chequeos aún'", () => {
        renderSemaforo("verde", "no-es-una-fecha");
        expect(screen.getByText("Sin chequeos aún")).toBeTruthy();
    });

    it("la configuración trae las 6 señales del tablero con hint criollo", () => {
        expect(SENALES_OPERACION.map((s) => s.clave)).toEqual([
            "app",
            "worker",
            "bd",
            "ollama_ping",
            "ollama_smoke",
            "tailscale",
        ]);
        for (const senal of SENALES_OPERACION) {
            expect(senal.nombre.length).toBeGreaterThan(0);
            expect(senal.hint.length).toBeGreaterThan(0);
        }
    });

    it("nombreSenal traduce la clave y cae en la clave si es desconocida", () => {
        expect(nombreSenal("ollama_ping")).toBe("Cerebro IA");
        expect(nombreSenal("senal_rara")).toBe("senal_rara");
    });
});
