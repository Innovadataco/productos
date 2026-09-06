/**
 * SPEC-557 (I-345) · CANDADO del toast de deshacer (cliente).
 *
 * Vigila la conducta que pidió Diseño: el toast dice QUÉ se hizo (categoría +
 * riesgo, así el operador nota el error aunque no deshaga), ofrece [Deshacer], y
 * se cierra solo al agotarse la ventana de 8 s (del cliente). No es modal.
 * Muere si desaparece el [Deshacer] o si deja de auto-cerrarse.
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts. La ventana de 8 s se
 * prueba con reloj CONTROLADO (fake timers) — determinista, no reloj de pared.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AvisoDeshacerConfirmacion } from "./AvisoDeshacerConfirmacion";

afterEach(() => vi.useRealTimers());

describe("SPEC-557 · toast de deshacer confirmación", () => {
    it("dice qué se hizo (categoría + riesgo) y ofrece [Deshacer]", () => {
        render(
            <AvisoDeshacerConfirmacion
                categoria="OFRECIMIENTO_REGALOS"
                nivelRiesgo="BAJO"
                onDeshacer={vi.fn()}
                onExpirar={vi.fn()}
            />,
        );
        expect(screen.getByText(/Clasificación aceptada:/)).toBeTruthy();
        expect(screen.getByText(/Ofrecimiento de regalos/)).toBeTruthy();
        expect(screen.getByText(/riesgo bajo/)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Deshacer" })).toBeTruthy();
        // No es modal: es un status, no un diálogo.
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("[Deshacer] dispara el rollback (onDeshacer)", () => {
        const onDeshacer = vi.fn();
        render(
            <AvisoDeshacerConfirmacion
                categoria="EXTORSION"
                nivelRiesgo="ALTO"
                onDeshacer={onDeshacer}
                onExpirar={vi.fn()}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
        expect(onDeshacer).toHaveBeenCalledTimes(1);
    });

    it("se cierra solo al agotarse la ventana de 8 s (reloj controlado)", () => {
        vi.useFakeTimers();
        const onExpirar = vi.fn();
        render(
            <AvisoDeshacerConfirmacion
                categoria="EXTORSION"
                nivelRiesgo="ALTO"
                onDeshacer={vi.fn()}
                onExpirar={onExpirar}
            />,
        );
        expect(onExpirar).not.toHaveBeenCalled();
        act(() => { vi.advanceTimersByTime(8000); });
        expect(onExpirar).toHaveBeenCalledTimes(1);
    });
});
