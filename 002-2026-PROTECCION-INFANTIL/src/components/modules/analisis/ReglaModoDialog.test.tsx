/**
 * SPEC-224 (002-PI-125, FR-009): tests de componente de ReglaModoDialog —
 * confirmación fuerte de la promoción a EJECUTA (escribir "EJECUTA" + motivo
 * ≥ 20, botón deshabilitado hasta cumplir ambos) y reversión a Recomienda
 * solo con motivo. Fetch mockeado (sin BD). Se usa fireEvent: el repo no
 * depende de @testing-library/user-event.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ReglaModoDialog } from "./ReglaModoDialog";

const REGLA_RECOMIENDA = { id: "regla-1", nombre: "Regla de prueba", modo: "RECOMIENDA" as const, activa: true };
const REGLA_EJECUTA = { ...REGLA_RECOMIENDA, modo: "EJECUTA" as const };

const MOTIVO_VALIDO = "la regla lleva 3 semanas estable";

function mockFetchOk() {
    return vi.fn(async () => ({
        ok: true,
        json: async () => ({ id: "regla-1", modo: "EJECUTA", advertencia: null }),
    }));
}

function escribir(etiqueta: RegExp, valor: string) {
    fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });
}

describe("ReglaModoDialog — promoción a EJECUTA", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", mockFetchOk());
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("el botón queda deshabilitado hasta escribir EJECUTA y un motivo de ≥ 20 caracteres", () => {
        render(<ReglaModoDialog regla={REGLA_RECOMIENDA} onClose={() => {}} onConfirmado={() => {}} />);

        const boton = screen.getByRole("button", { name: "Confirmar EJECUTA" });
        expect((boton as HTMLButtonElement).disabled).toBe(true);

        // Solo confirmación: sigue deshabilitado.
        escribir(/Escribe "EJECUTA"/, "EJECUTA");
        expect((boton as HTMLButtonElement).disabled).toBe(true);

        // Motivo corto: sigue deshabilitado.
        escribir(/Motivo/, "corto");
        expect((boton as HTMLButtonElement).disabled).toBe(true);

        // Motivo válido: se habilita.
        escribir(/Motivo/, MOTIVO_VALIDO);
        expect((boton as HTMLButtonElement).disabled).toBe(false);
    });

    it("la confirmación debe ser exactamente EJECUTA (minúsculas no habilitan)", () => {
        render(<ReglaModoDialog regla={REGLA_RECOMIENDA} onClose={() => {}} onConfirmado={() => {}} />);

        escribir(/Escribe "EJECUTA"/, "ejecuta");
        escribir(/Motivo/, "motivo de más de veinte caracteres");
        expect((screen.getByRole("button", { name: "Confirmar EJECUTA" }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("al confirmar llama al endpoint con modo, confirmacion y motivo", async () => {
        const fetchMock = mockFetchOk();
        vi.stubGlobal("fetch", fetchMock);
        const onConfirmado = vi.fn();
        render(<ReglaModoDialog regla={REGLA_RECOMIENDA} onClose={() => {}} onConfirmado={onConfirmado} />);

        escribir(/Escribe "EJECUTA"/, "EJECUTA");
        escribir(/Motivo/, MOTIVO_VALIDO);
        fireEvent.click(screen.getByRole("button", { name: "Confirmar EJECUTA" }));

        await waitFor(() => expect(onConfirmado).toHaveBeenCalledWith({ id: "regla-1", modo: "EJECUTA", advertencia: null }));
        const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
        expect(url).toBe("/api/admin/analisis/reglas/regla-1/modo");
        expect(JSON.parse(String(init.body))).toEqual({
            modo: "EJECUTA",
            confirmacion: "EJECUTA",
            motivo: MOTIVO_VALIDO,
        });
    });

    it("muestra el error del servidor sin cerrar el diálogo", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: false,
                json: async () => ({ error: { message: "La regla ya está en modo EJECUTA" } }),
            }))
        );
        const onConfirmado = vi.fn();
        render(<ReglaModoDialog regla={REGLA_RECOMIENDA} onClose={() => {}} onConfirmado={onConfirmado} />);

        escribir(/Escribe "EJECUTA"/, "EJECUTA");
        escribir(/Motivo/, MOTIVO_VALIDO);
        fireEvent.click(screen.getByRole("button", { name: "Confirmar EJECUTA" }));

        expect(await screen.findByText("La regla ya está en modo EJECUTA")).not.toBeNull();
        expect(onConfirmado).not.toHaveBeenCalled();
    });
});

describe("ReglaModoDialog — reversión a Recomienda", () => {
    beforeEach(() => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => ({
                ok: true,
                json: async () => ({ id: "regla-1", modo: "RECOMIENDA", advertencia: null }),
            }))
        );
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("no pide confirmación de texto, solo motivo ≥ 20", () => {
        render(<ReglaModoDialog regla={REGLA_EJECUTA} onClose={() => {}} onConfirmado={() => {}} />);

        expect(screen.queryByLabelText(/Escribe "EJECUTA"/)).toBeNull();
        const boton = screen.getByRole("button", { name: "Confirmar Recomienda" });
        expect((boton as HTMLButtonElement).disabled).toBe(true);

        escribir(/Motivo/, "vuelve a revisión humana por ruido");
        expect((boton as HTMLButtonElement).disabled).toBe(false);
    });
});
