import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FechaHoraIncidente } from "./FechaHoraIncidente";

/**
 * A-74 · P1 (SPEC-368) — el control amable reemplaza al `datetime-local` nativo,
 * que pintaba minutos aun con step=3600. Estos tests blindan los candados de B1
 * (SPEC-359) para que el reemplazo no los pierda.
 */
describe("FechaHoraIncidente · control amable de la fecha del hecho", () => {
    // "Ahora" fijo: 2 de septiembre de 2026, 10 a.m. hora local.
    const MAX = "2026-09-02T10:00";

    function pintar(value: string, onChange = vi.fn()) {
        render(<FechaHoraIncidente value={value} max={MAX} onChange={onChange} />);
        return onChange;
    }

    it("pregunta en tres piezas y NO muestra minutos", () => {
        pintar("");
        expect(screen.getByLabelText("Día del incidente")).toBeTruthy();
        expect(screen.getByLabelText("Hora del incidente")).toBeTruthy();
        expect(screen.getByLabelText("a.m. o p.m.")).toBeTruthy();
        // El texto del control no ofrece minutos en ninguna parte.
        expect(document.body.textContent).not.toMatch(/minuto exacto\?|:\d{2}/);
    });

    it("candado B1: el día no puede ser futuro (tope en hora LOCAL)", () => {
        pintar("");
        const dia = screen.getByLabelText("Día del incidente") as HTMLInputElement;
        expect(dia.max).toBe("2026-09-02");
    });

    it("candado B1 · borde de HOY: las horas que aún no pasaron quedan deshabilitadas", () => {
        // Con el día de hoy elegido y a.m. seleccionado, 11 y 12 (a.m.) son futuro.
        pintar("2026-09-02T09:00");
        const opciones = screen.getAllByRole("option") as HTMLOptionElement[];
        const hora = (h: string) => opciones.find((o) => o.textContent === h && o.parentElement?.getAttribute("aria-label") === "Hora del incidente");

        expect(hora("9")?.disabled).toBe(false);
        expect(hora("11")?.disabled).toBe(true);
        // Y p.m. entero es futuro si aún no es mediodía.
        const pm = opciones.find((o) => o.value === "pm");
        expect(pm?.disabled).toBe(true);
    });

    it("un día ANTERIOR habilita todas las horas (solo hoy tiene futuro que bloquear)", () => {
        pintar("2026-09-01T09:00");
        const opciones = screen.getAllByRole("option") as HTMLOptionElement[];
        const pm = opciones.find((o) => o.value === "pm");
        expect(pm?.disabled).toBe(false);
    });

    it("candado G20: lo que emite es SIEMPRE hora en punto, con el contrato de antes", () => {
        const onChange = pintar("2026-09-01T09:00");
        fireEvent.change(screen.getByLabelText("Hora del incidente"), { target: { value: "3" } });
        expect(onChange).toHaveBeenCalledWith("2026-09-01T03:00");

        fireEvent.change(screen.getByLabelText("a.m. o p.m."), { target: { value: "pm" } });
        expect(onChange).toHaveBeenLastCalledWith("2026-09-01T21:00");
    });

    it("si el día cambia a HOY y la hora elegida quedaba en el futuro, se baja al tope", () => {
        const onChange = pintar("2026-09-01T20:00"); // ayer 8 p.m.
        fireEvent.change(screen.getByLabelText("Día del incidente"), { target: { value: "2026-09-02" } });
        // Hoy son las 10 a.m.: las 8 p.m. no existen todavía.
        expect(onChange).toHaveBeenCalledWith("2026-09-02T10:00");
    });

    it("muestra el error del servidor (que nombra el campo)", () => {
        render(
            <FechaHoraIncidente
                value=""
                max={MAX}
                onChange={vi.fn()}
                error="Fecha y hora del incidente: el hecho no puede ser a futuro"
            />
        );
        expect(screen.getByRole("alert").textContent).toContain("Fecha y hora del incidente");
    });
});
