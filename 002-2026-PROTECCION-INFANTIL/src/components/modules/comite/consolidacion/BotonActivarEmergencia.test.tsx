/**
 * SPEC-239 (002-PI-mega-cola): tests de componente de BotonActivarEmergencia
 * (T022): visible solo en ROJO, modal confirma/cancela y llamada al endpoint.
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { BotonActivarEmergencia } from "./BotonActivarEmergencia";

vi.mock("next/navigation", () => ({
    useRouter: () => ({ refresh: vi.fn() }),
}));

const fetchMock = vi.fn();

beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("BotonActivarEmergencia (SPEC-239)", () => {
    it("no se renderiza cuando la gravedad no es ROJO (US5.2)", () => {
        const { container } = render(
            <BotonActivarEmergencia expedienteId="exp-1" scoreGravedadActual="AMARILLO" />
        );
        expect(container.firstChild).toBeNull();
        expect(screen.queryByText("Activar emergencia")).toBeNull();
    });

    it("se renderiza en ROJO y abre el modal de confirmación (US5.1/US5.3)", () => {
        render(<BotonActivarEmergencia expedienteId="exp-1" scoreGravedadActual="ROJO" />);
        fireEvent.click(screen.getByText("Activar emergencia"));
        expect(screen.getByText(/notifica de inmediato al contacto de emergencia de mayor prioridad/)).toBeTruthy();
        expect(screen.getByText("Confirmar activación")).toBeTruthy();
        expect(screen.getByText("Cancelar")).toBeTruthy();
    });

    it("cancelar cierra el modal sin llamar al endpoint (US5.5)", async () => {
        render(<BotonActivarEmergencia expedienteId="exp-1" scoreGravedadActual="ROJO" />);
        fireEvent.click(screen.getByText("Activar emergencia"));
        fireEvent.click(screen.getByText("Cancelar"));
        await waitFor(() => expect(screen.queryByText("Confirmar activación")).toBeNull());
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("confirmar ejecuta POST al endpoint de activación (US5.4)", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ notificacionProgramada: true }), { status: 200 })
        );
        render(<BotonActivarEmergencia expedienteId="exp-1" scoreGravedadActual="ROJO" />);
        fireEvent.click(screen.getByText("Activar emergencia"));
        fireEvent.click(screen.getByText("Confirmar activación"));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        const [url, init] = fetchMock.mock.calls[0]!;
        expect(url).toBe("/api/admin/comite/expediente/exp-1/activar-emergencia");
        expect((init as RequestInit).method).toBe("POST");
        await waitFor(() =>
            expect(screen.getByText(/Emergencia activada/)).toBeTruthy()
        );
    });

    it("muestra el error del endpoint sin cerrar el flujo", async () => {
        fetchMock.mockResolvedValueOnce(
            new Response(JSON.stringify({ error: { message: "Solo se puede activar emergencia en expedientes con gravedad ROJO" } }), { status: 409 })
        );
        render(<BotonActivarEmergencia expedienteId="exp-1" scoreGravedadActual="ROJO" />);
        fireEvent.click(screen.getByText("Activar emergencia"));
        fireEvent.click(screen.getByText("Confirmar activación"));
        await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("gravedad ROJO"));
    });
});
