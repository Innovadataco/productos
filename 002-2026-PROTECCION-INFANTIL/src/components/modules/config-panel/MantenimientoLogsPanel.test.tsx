/**
 * SPEC-193 / 002-PI-096 — Tests unitarios del panel de mantenimiento de logs.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MantenimientoLogsPanel } from "./MantenimientoLogsPanel";

describe("MantenimientoLogsPanel", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                status: 200,
                json: async () => ({ total: 0 }),
            } as Response))
        );
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza los campos de purga y el botón de confirmar inicia deshabilitado", () => {
        render(<MantenimientoLogsPanel />);

        expect(screen.getByLabelText("Hasta")).toBeTruthy();
        expect(screen.getByLabelText("Servicio")).toBeTruthy();
        expect(screen.getByLabelText("Nivel")).toBeTruthy();
        expect(screen.getByLabelText("Motivo de la purga")).toBeTruthy();

        const botonConfirmar = screen.getByRole("button", { name: "Confirmar purga" });
        expect(botonConfirmar.hasAttribute("disabled")).toBe(true);

        const botonContar = screen.getByRole("button", { name: "Contar filas afectadas" });
        expect(botonContar.hasAttribute("disabled")).toBe(true);
    });

    it("habilita el botón contar cuando hay fecha límite", () => {
        render(<MantenimientoLogsPanel />);

        const input = screen.getByLabelText("Hasta");
        fireEvent.change(input, { target: { value: "2026-08-20T12:00" } });

        const botonContar = screen.getByRole("button", { name: "Contar filas afectadas" });
        expect(botonContar.hasAttribute("disabled")).toBe(false);
    });
});
