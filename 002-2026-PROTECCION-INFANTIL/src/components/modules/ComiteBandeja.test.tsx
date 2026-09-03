import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
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
    return vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
        const url = input.toString();
        if (url.includes("/api/admin/comite/consolidacion")) {
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ items: [], pagination: { page: 1, pageSize: 50, total: 0, totalPages: 0 } }),
            } as Response);
        }
        return Promise.resolve({
            ok,
            status: ok ? 200 : 500,
            json: async () => ({ solicitudes: list, paginacion: { page: 1, limit: 20, total: list.length, totalPages: 1 } }),
        } as Response);
    });
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

    // SPEC-384 · I-279: si asignar falla, el banner ahora muestra el mensaje
    // REAL del backend (antes se descartaba y se pintaba un texto fijo falso
    // que decía «No pudimos cargar las solicitudes» mientras la lista estaba
    // cargada). Además la lista NO se marca en error — se cargó bien.
    it("I-279: cuando /asignar falla, el banner muestra el mensaje real del backend y la lista sigue visible", async () => {
        vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
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
                    ok: false,
                    status: 403,
                    json: async () => ({ error: { message: "El caso ya fue asignado a otro miembro del comité" } }),
                } as Response);
            }
            return Promise.resolve({ ok: true, status: 200, json: async () => ({}) } as Response);
        });

        render(<ComiteBandeja />);
        await waitFor(() => expect(document.body.textContent).not.toContain("Cargando..."));
        // La lista está cargada — la fila existe.
        expect(document.body.textContent).toContain("SOL-001");

        screen.getByText("Ver").click();
        await waitFor(() => {
            // El mensaje real del backend llegó a pantalla — bajo el título de acción,
            // no el título viejo «No pudimos cargar las solicitudes».
            expect(document.body.textContent).toContain("El caso ya fue asignado a otro miembro del comité");
            expect(document.body.textContent).toContain("No pudimos abrir el caso");
        });
        // Candado del banner viejo: NO decimos que la lista falló, porque no falló.
        expect(document.body.textContent).not.toContain("Ocurrió un problema al consultar la bandeja del comité");
        // Y la fila sigue visible.
        expect(document.body.textContent).toContain("SOL-001");
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

// SPEC-237 (002-PI-mega-cola): bandeja unificada — filtro por tipo, badge e
// indicador de SLA (T017/T032/T036).
describe("ComiteBandeja — SPEC-237 bandeja unificada", () => {
    const solicitudBase = {
        id: "s1",
        numero: "SOL-001",
        reporteId: "r1",
        estado: "PENDIENTE",
        motivo: "M1",
        creadoEn: new Date().toISOString(),
        comiteId: null,
        sla: { fechaLimite: new Date(Date.now() + 48 * 3600 * 1000).toISOString(), color: "pino", vencido: false },
    };

    const consolidacionBase = {
        id: "inf1",
        expedienteId: "exp1",
        tipo: "CONSOLIDACION_EXPEDIENTE",
        estadoAprobacion: "PENDIENTE_COMITE",
        identificadorPrincipal: "+573001234567",
        estadoExpediente: "PENDIENTE_COMITE",
        categoriaDominante: "CONTACTO_INSISTENTE",
        sla: { fechaLimite: new Date(Date.now() - 3600 * 1000).toISOString(), color: "rubi", vencido: true },
        aprobacionesActuales: 1,
        aprobacionesRequeridas: 2,
        createdAt: new Date().toISOString(),
    };

    function mockFetchUnificado({ solicitudes = [solicitudBase], consolidaciones = [consolidacionBase] } = {}) {
        return vi.spyOn(global, "fetch").mockImplementation((input: RequestInfo | URL) => {
            const url = input.toString();
            if (url.includes("/api/admin/comite/consolidacion")) {
                return Promise.resolve({
                    ok: true,
                    status: 200,
                    json: async () => ({ items: consolidaciones, pagination: { page: 1, pageSize: 50, total: consolidaciones.length, totalPages: 1 } }),
                } as Response);
            }
            return Promise.resolve({
                ok: true,
                status: 200,
                json: async () => ({ solicitudes, paginacion: { page: 1, limit: 20, total: solicitudes.length, totalPages: 1 } }),
            } as Response);
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockAuth({ id: "comite-1", rol: "COMITE_VALIDACION", nombre: "Comité", email: "c@test.com" });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("muestra ambos tipos con badge distintivo cuando el filtro es Todas", async () => {
        mockFetchUnificado();
        render(<ComiteBandeja />);
        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });
        expect(screen.getByTestId("badge-revision")).toBeTruthy();
        expect(screen.getByTestId("badge-consolidacion")).toBeTruthy();
        expect(document.body.textContent).toContain("SOL-001");
        expect(document.body.textContent).toContain("+573001234567");
    });

    it("el filtro Consolidaciones lista solo tareas de ese tipo", async () => {
        mockFetchUnificado();
        render(<ComiteBandeja />);
        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });
        fireEvent.change(screen.getByLabelText("Tipo de tarea"), { target: { value: "CONSOLIDACION_EXPEDIENTE" } });
        expect(document.body.textContent).toContain("+573001234567");
        expect(document.body.textContent).not.toContain("SOL-001");
        expect(screen.queryByTestId("badge-revision")).toBeNull();
    });

    it("el filtro Revisiones de reporte lista solo solicitudes", async () => {
        mockFetchUnificado();
        render(<ComiteBandeja />);
        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });
        fireEvent.change(screen.getByLabelText("Tipo de tarea"), { target: { value: "REVISION_REPORTE" } });
        expect(document.body.textContent).toContain("SOL-001");
        expect(document.body.textContent).not.toContain("+573001234567");
        expect(screen.queryByTestId("badge-consolidacion")).toBeNull();
    });

    it("pinta el indicador de SLA con el color que llega del servidor", async () => {
        mockFetchUnificado();
        render(<ComiteBandeja />);
        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });
        expect(screen.getByTestId("sla-pino")).toBeTruthy();
        expect(screen.getByTestId("sla-rubi").textContent).toContain("vencido");
    });

    it("la fila de consolidación enlaza a la vista de consolidación", async () => {
        mockFetchUnificado();
        render(<ComiteBandeja />);
        await waitFor(() => {
            expect(document.body.textContent).not.toContain("Cargando...");
        });
        const enlace = screen.getByText("Revisar").closest("a");
        expect(enlace?.getAttribute("href")).toBe("/dashboard/admin/comite/consolidacion/exp1");
    });
});
