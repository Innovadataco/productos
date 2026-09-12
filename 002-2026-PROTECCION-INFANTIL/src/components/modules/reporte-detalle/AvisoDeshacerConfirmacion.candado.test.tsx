/**
 * SPEC-557 (I-345) · CANDADO del toast de deshacer (cliente).
 * SPEC-660 (Fase D): el componente se generalizó (recibe `mensaje` en vez de la
 * clasificación del reporte). Este candado vigila su CONDUCTA genérica —la que
 * pidió Diseño y comparten los dos consumidores—: muestra QUÉ se hizo (el
 * `mensaje` que le pasan, así el usuario nota el error aunque no deshaga), ofrece
 * [Deshacer], y se cierra solo al agotarse la ventana de 8 s (del cliente). No es
 * modal. Muere si desaparece el [Deshacer] o si deja de auto-cerrarse.
 *
 * Integración (jsdom); no toca vitest.unit.includes.ts. La ventana de 8 s se
 * prueba con reloj CONTROLADO (fake timers) — determinista, no reloj de pared.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AvisoDeshacerConfirmacion } from "./AvisoDeshacerConfirmacion";

afterEach(() => vi.useRealTimers());

describe("SPEC-557/660 · toast de deshacer", () => {
    it("muestra el mensaje que le pasan y ofrece [Deshacer], sin ser modal", () => {
        render(
            <AvisoDeshacerConfirmacion
                mensaje="Quitaste robloxjuan de tu lista."
                onDeshacer={vi.fn()}
                onExpirar={vi.fn()}
            />,
        );
        expect(screen.getByText(/Quitaste robloxjuan de tu lista\./)).toBeTruthy();
        expect(screen.getByRole("button", { name: "Deshacer" })).toBeTruthy();
        // No es modal: es un status, no un diálogo.
        expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("[Deshacer] dispara el rollback (onDeshacer)", () => {
        const onDeshacer = vi.fn();
        render(
            <AvisoDeshacerConfirmacion mensaje="algo" onDeshacer={onDeshacer} onExpirar={vi.fn()} />,
        );
        fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
        expect(onDeshacer).toHaveBeenCalledTimes(1);
    });

    it("se cierra solo al agotarse la ventana de 8 s (reloj controlado)", () => {
        vi.useFakeTimers();
        const onExpirar = vi.fn();
        render(
            <AvisoDeshacerConfirmacion mensaje="algo" onDeshacer={vi.fn()} onExpirar={onExpirar} />,
        );
        expect(onExpirar).not.toHaveBeenCalled();
        act(() => {
            vi.advanceTimersByTime(8000);
        });
        expect(onExpirar).toHaveBeenCalledTimes(1);
    });
});
