import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ComiteBandeja } from "./ComiteBandeja";

vi.mock("@/lib/contexts/AuthContext", () => ({
    useAuth: vi.fn(),
}));

vi.mock("./ComiteSolicitudDetalle", () => ({
    ComiteSolicitudDetalle: ({ solicitud }: { solicitud: { numero: string } }) => (
        <div data-testid="detalle">Detalle {solicitud.numero}</div>
    ),
}));

import { useAuth } from "@/lib/contexts/AuthContext";

function mockAuth(user: { id: string; rol: string; nombre: string; email: string } | null) {
    (useAuth as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        user,
        isLoading: false,
        isAuthenticated: !!user,
        login: vi.fn(),
        logout: vi.fn(),
        checkSession: vi.fn(),
    });
}

function mockFetch(list: unknown[], ok = true) {
    return vi.spyOn(global, "fetch").mockResolvedValue({
        ok,
        status: ok ? 200 : 500,
        json: async () => ({ solicitudes: list, paginacion: { page: 1, limit: 20, total: list.length, totalPages: 1 } }),
    } as Response);
}

describe("ComiteBandeja", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth({ id: "comite-1", rol: "COMITE_VALIDACION", nombre: "Comité", email: "c@test.com" });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("no muestra pestañas y lista todos los casos", async () => {
        mockFetch([
            { id: "s1", numero: "SOL-001", reporteId: "r1", estado: "PENDIENTE", motivo: "M1", creadoEn: new Date().toISOString(), comiteId: null },
            { id: "s2", numero: "SOL-002", reporteId: "r2", estado: "ASIGNADA", motivo: "M2", creadoEn: new Date().toISOString(), comiteId: "comite-1" },
        ]);
        render(<ComiteBandeja />);

        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });

        expect(document.body.textContent).not.toContain("Pendientes");
        expect(document.body.textContent).not.toContain("Mías");
        expect(document.body.textContent).toContain("SOL-001");
        expect(document.body.textContent).toContain("SOL-002");
    });

    it("auto-asigna al abrir un caso PENDIENTE", async () => {
        const fetchSpy = vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes("/api/admin/comite/solicitudes")) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({
                        solicitudes: [
                            { id: "s1", numero: "SOL-001", reporteId: "r1", estado: "PENDIENTE", motivo: "M1", creadoEn: new Date().toISOString(), comiteId: null },
                        ],
                        paginacion: { page: 1, limit: 20, total: 1, totalPages: 1 },
                    }),
                } as Response);
            }
            if (url.includes("/api/admin/comite/s1/asignar")) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ estado: "ASIGNADA", comiteId: "comite-1" }),
                } as Response);
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
        });

        render(<ComiteBandeja />);
        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });

        screen.getByText("Ver").click();
        await waitFor(() => {
            expect(document.body.textContent).toContain("Detalle SOL-001");
        });

        const asignarCall = fetchSpy.mock.calls.find((c) => c[0].toString().includes("/asignar"));
        expect(asignarCall).toBeDefined();
    });
});
