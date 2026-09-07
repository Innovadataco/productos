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

/**
 * SPEC-580 · el modo «no recuerdo la hora» es un checkbox que intercambia la
 * hora exacta por la franja aproximada (SPEC-438). El contrato `onChange` no
 * cambia: franja → `(isoRepresentativo, true)`; sin valor posible → `""` (el
 * wizard bloquea «Siguiente» y la única salida sin hora exacta es la franja).
 */
describe("FechaHoraIncidente · SPEC-580 · modo «no recuerdo la hora»", () => {
    const MAX = "2026-09-02T10:00";

    // El componente emite wall-time en la zona del proceso; las franjas se
    // definen en hora de Bogotá, así que las comparaciones se hacen SIEMPRE
    // convertidas a Bogotá (independiente del TZ donde corra el test).
    function partesBogota(valorLocal: string): { dia: string; hora: number } {
        const d = new Date(valorLocal);
        const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(d);
        const hora = Number(
            new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Bogota",
                hour: "numeric",
                hour12: false,
            }).format(d)
        );
        return { dia, hora };
    }

    function pintar(value: string, onChange = vi.fn()) {
        render(<FechaHoraIncidente value={value} max={MAX} onChange={onChange} />);
        return onChange;
    }

    const CHECKBOX = "No recuerdo la hora";
    const SELECT_FRANJA = "Franja aproximada del incidente";

    it("renderiza el checkbox «No recuerdo la hora» accesible (label htmlFor)", () => {
        pintar("");
        const checkbox = screen.getByLabelText(CHECKBOX) as HTMLInputElement;
        expect(checkbox.type).toBe("checkbox");
        expect(checkbox.checked).toBe(false);
    });

    it("por defecto NO muestra la franja y SÍ los selects de hora exacta", () => {
        pintar("");
        expect(screen.queryByLabelText(SELECT_FRANJA)).toBeNull();
        expect(screen.getByLabelText("Hora del incidente")).toBeTruthy();
        expect(screen.getByLabelText("a.m. o p.m.")).toBeTruthy();
    });

    it("al activar el checkbox: aparece la franja y desaparecen hora y meridiano", () => {
        pintar("");
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        expect(screen.getByLabelText(SELECT_FRANJA)).toBeTruthy();
        expect(screen.queryByLabelText("Hora del incidente")).toBeNull();
        expect(screen.queryByLabelText("a.m. o p.m.")).toBeNull();
        // El día sigue editable en modo franja.
        expect(screen.getByLabelText("Día del incidente")).toBeTruthy();
    });

    it("con checkbox activo y sin franja elegida emite cadena vacía (el wizard bloquea avanzar)", () => {
        const onChange = pintar("2026-09-01T09:00");
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        expect(onChange).toHaveBeenLastCalledWith("");
    });

    it("el select de franja está deshabilitado hasta que hay día elegido", () => {
        pintar("");
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        expect((screen.getByLabelText(SELECT_FRANJA) as HTMLSelectElement).disabled).toBe(true);
    });

    it("elegir franja (con día elegido) emite el instante representativo marcado aproximado", () => {
        const onChange = pintar("");
        fireEvent.change(screen.getByLabelText("Día del incidente"), { target: { value: "2026-09-01" } });
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        fireEvent.change(screen.getByLabelText(SELECT_FRANJA), { target: { value: "tarde" } });

        const llamada = onChange.mock.calls.at(-1);
        expect(llamada?.[1]).toBe(true);
        const emitido = partesBogota(String(llamada?.[0]));
        // HORA_REPRESENTATIVA.tarde = 15 (centro de 12–18), en el día elegido.
        expect(emitido.dia).toBe("2026-09-01");
        expect(emitido.hora).toBe(15);
    });

    it("el select de franja es controlado: refleja la franja elegida", () => {
        pintar("");
        fireEvent.change(screen.getByLabelText("Día del incidente"), { target: { value: "2026-09-01" } });
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        fireEvent.change(screen.getByLabelText(SELECT_FRANJA), { target: { value: "noche" } });
        expect((screen.getByLabelText(SELECT_FRANJA) as HTMLSelectElement).value).toBe("noche");
    });

    it("en modo franja no es posible tocar la hora: los selects no existen en el documento", () => {
        pintar("");
        fireEvent.change(screen.getByLabelText("Día del incidente"), { target: { value: "2026-09-01" } });
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        fireEvent.change(screen.getByLabelText(SELECT_FRANJA), { target: { value: "manana" } });
        expect(screen.queryByLabelText("Hora del incidente")).toBeNull();
        expect(screen.queryByLabelText("a.m. o p.m.")).toBeNull();
    });

    it("al desactivar el checkbox vuelve la hora exacta y se re-emite con aproximada=false", () => {
        const onChange = pintar("2026-09-01T09:00");
        const checkbox = screen.getByLabelText(CHECKBOX);
        fireEvent.click(checkbox); // activa franja → ""
        fireEvent.click(checkbox); // vuelve a hora exacta
        expect(screen.getByLabelText("Hora del incidente")).toBeTruthy();
        expect(onChange).toHaveBeenLastCalledWith("2026-09-01T09:00", false);
    });

    it("cambiar el día en modo franja re-emite la misma franja sobre el día nuevo", () => {
        const onChange = pintar("");
        fireEvent.change(screen.getByLabelText("Día del incidente"), { target: { value: "2026-09-01" } });
        fireEvent.click(screen.getByLabelText(CHECKBOX));
        fireEvent.change(screen.getByLabelText(SELECT_FRANJA), { target: { value: "noche" } });
        fireEvent.change(screen.getByLabelText("Día del incidente"), { target: { value: "2026-08-31" } });

        const llamada = onChange.mock.calls.at(-1);
        expect(llamada?.[1]).toBe(true);
        const emitido = partesBogota(String(llamada?.[0]));
        expect(emitido.dia).toBe("2026-08-31");
        expect(emitido.hora).toBe(21);
    });
});
