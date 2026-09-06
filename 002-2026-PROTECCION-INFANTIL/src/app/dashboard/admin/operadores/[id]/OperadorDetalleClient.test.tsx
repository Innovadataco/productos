/**
 * SPEC-189 (002-PI-084): test de renderizado de la ficha de operador.
 * SPEC-571: el componente cliente se extrajo de page.tsx (split de guardia) a
 * OperadorDetalleClient.tsx; este test lo prueba directamente (page.tsx es ahora
 * el wrapper de servidor que guarda el rol).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminOperadorDetallePage from "./OperadorDetalleClient";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
    useParams: () => ({ id: "operador-1" }),
    useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/components/modules/AdminReporteDetalle", () => ({
    AdminReporteDetalle: ({ reporteId }: { reporteId: string }) => (
        <div data-testid="detalle-modal">Detalle {reporteId}</div>
    ),
}));

const METRICAS = {
    operador: { id: "operador-1", email: "op@test.com", nombre: "Operador Test", cupoMaximo: 10 },
    casosAbiertos: [
        {
            id: "rep-1",
            numeroSeguimiento: "RPT-001",
            identificador: "+573001234567",
            plataformaClave: "whatsapp",
            plataformaNombre: "WhatsApp",
            categoria: "CONTACTO_INSISTENTE",
            estado: "REVISION_MANUAL",
            asignadoEn: new Date(Date.now() - 90 * 60000).toISOString(),
            tiempoDesdeAsignacionMs: 90 * 60000,
        },
    ],
    casosResueltos24h: 1,
    casosResueltos7d: 3,
    casosResueltos30d: 5,
    tiempoMedioResolucionMs: 120 * 60000,
    casosPorCategoria: [
        { categoria: "CONTACTO_INSISTENTE", total: 3 },
        { categoria: "SOLICITUD_MATERIAL", total: 2 },
    ],
    tasaEscalamientoComite: 0.2,
};

const CASOS = {
    items: [
        {
            id: "rep-2",
            numeroSeguimiento: "RPT-002",
            identificador: "+573009876543",
            plataformaClave: "telegram",
            plataformaNombre: "Telegram",
            estado: "CORREGIDO",
            categoria: "SOLICITUD_MATERIAL",
            asignadoEn: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        },
    ],
    pagination: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
};

function mockFetch(payloads: Record<string, unknown>) {
    return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
        const url = String(input);
        for (const [prefix, payload] of Object.entries(payloads)) {
            if (url.includes(prefix)) {
                return { ok: true, status: 200, json: async () => payload } as Response;
            }
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
}

describe("AdminOperadorDetallePage (SPEC-189)", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza cabecera, métricas, casos abiertos y distribución", async () => {
        mockFetch({
            "/api/admin/operadores/operador-1/metricas": METRICAS,
            "/api/admin/operadores/operador-1/casos": CASOS,
        });
        render(<AdminOperadorDetallePage />);

        expect(screen.getByText("Cargando métricas...")).toBeTruthy();

        await waitFor(() => {
            expect(screen.getByText("Operador Test")).toBeTruthy();
        });

        expect(screen.getByText((content) => content.includes("op@test.com"))).toBeTruthy();
        expect(screen.getByText("Volver a asignar")).toBeTruthy();
        expect(screen.getByText("2h 0m")).toBeTruthy(); // tiempo medio
        expect(screen.getAllByText("3").length).toBeGreaterThanOrEqual(2); // resueltos 7d + distribución
        expect(screen.getByText("20%")).toBeTruthy(); // tasa
        expect(screen.getByText("Contacto insistente (3)")).toBeTruthy(); // categoria top

        expect(screen.getByText("RPT-001")).toBeTruthy();
        expect(screen.getByText("1h 30m")).toBeTruthy();

        await waitFor(() => {
            expect(screen.getByText("RPT-002")).toBeTruthy();
        });
    });

    it("cambia el filtro de estado y vuelve a página 1", async () => {
        const fetchSpy = mockFetch({
            "/api/admin/operadores/operador-1/metricas": METRICAS,
            "/api/admin/operadores/operador-1/casos": CASOS,
        });
        render(<AdminOperadorDetallePage />);

        await waitFor(() => {
            expect(screen.getByText("RPT-002")).toBeTruthy();
        });

        // Ya hay una llamada inicial con CORREGIDO
        const llamadasIniciales = fetchSpy.mock.calls.filter((call) =>
            String(call[0]).includes("/api/admin/operadores/operador-1/casos")
        );
        expect(llamadasIniciales.length).toBeGreaterThanOrEqual(1);
        expect(String(llamadasIniciales[llamadasIniciales.length - 1][0])).toContain("estado=CORREGIDO");

        fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "REVISION_MANUAL" } });

        await waitFor(() => {
            const llamadas = fetchSpy.mock.calls.filter((call) =>
                String(call[0]).includes("/api/admin/operadores/operador-1/casos")
            );
            expect(String(llamadas[llamadas.length - 1][0])).toContain("estado=REVISION_MANUAL");
        });
    });

    it("muestra error si el endpoint de métricas falla", async () => {
        vi.spyOn(global, "fetch").mockImplementation(async () => {
            return {
                ok: false,
                status: 404,
                json: async () => ({ error: { message: "Operador no encontrado" } }),
            } as Response;
        });
        render(<AdminOperadorDetallePage />);

        await waitFor(() => {
            expect(screen.getAllByText("Operador no encontrado").length).toBeGreaterThanOrEqual(1);
        });
    });

    it("abre el modal de detalle al hacer clic en Ver detalle", async () => {
        mockFetch({
            "/api/admin/operadores/operador-1/metricas": METRICAS,
            "/api/admin/operadores/operador-1/casos": CASOS,
        });
        render(<AdminOperadorDetallePage />);

        await waitFor(() => {
            expect(screen.getAllByText("Ver detalle").length).toBeGreaterThanOrEqual(1);
        });

        fireEvent.click(screen.getAllByText("Ver detalle")[0]);

        await waitFor(() => {
            expect(screen.getByTestId("detalle-modal")).toBeTruthy();
        });
    });
});
