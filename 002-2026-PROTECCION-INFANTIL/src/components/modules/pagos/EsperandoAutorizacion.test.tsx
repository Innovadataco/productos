import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { EsperandoAutorizacion } from "./EsperandoAutorizacion";
import type { SuscripcionPendienteDTO } from "@/lib/pagos/planes-selector.types";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const suscripcionPendiente: SuscripcionPendienteDTO = {
    id: "sub_123",
    estado: "PENDIENTE_AUTORIZACION",
    fechaInicio: new Date().toISOString(),
    fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    plan: { nombre: "Plan mensual" },
};

describe("EsperandoAutorizacion (SPEC-247)", () => {
    let fetchMock: MockInstance<typeof globalThis.fetch>;

    beforeEach(() => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        mockPush.mockClear();
        mockRefresh.mockClear();
        fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(() =>
            Promise.resolve(new Response(JSON.stringify({ estado: "PENDIENTE_AUTORIZACION" }), { status: 200 }))
        ) as MockInstance<typeof globalThis.fetch>;
    });

    afterEach(() => {
        fetchMock.mockRestore();
        vi.useRealTimers();
    });

    it("muestra el estado pendiente", () => {
        render(<EsperandoAutorizacion suscripcion={suscripcionPendiente} rol="PARENT" />);
        expect(screen.getByText("Solicitud en revisión")).toBeTruthy();
        expect(screen.getByText("Pendiente de autorización")).toBeTruthy();
    });

    it("consulta el estado periódicamente y redirige al activarse", async () => {
        fetchMock
            .mockResolvedValueOnce(new Response(JSON.stringify({ estado: "PENDIENTE_AUTORIZACION" }), { status: 200 }))
            .mockResolvedValueOnce(new Response(JSON.stringify({ estado: "ACTIVA" }), { status: 200 }));

        render(<EsperandoAutorizacion suscripcion={suscripcionPendiente} rol="PARENT" />);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        vi.advanceTimersByTime(10_000);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(mockPush).toHaveBeenCalledWith("/dashboard/padre/suscripcion?bienvenida=1")
        );
        expect(mockRefresh).toHaveBeenCalled();
    });

    it("no redirige mientras sigue pendiente", async () => {
        render(<EsperandoAutorizacion suscripcion={suscripcionPendiente} rol="SCHOOL_ADMIN" />);

        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
        vi.advanceTimersByTime(10_000);
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
        expect(mockPush).not.toHaveBeenCalled();
    });
});
