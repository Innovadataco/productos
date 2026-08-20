import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AdminReportesTable } from "./AdminReportesTable";

const pushMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParams,
    useRouter: () => ({ push: pushMock }),
    usePathname: () => "/dashboard/admin",
}));

function reporteBase(overrides: Record<string, unknown> = {}) {
    return {
        id: "reporte-123",
        identificador: "+57300TEST000",
        numeroSeguimiento: "RPT-TEST001",
        estado: "REVISION_MANUAL",
        esAnonimo: false,
        prioridadAlta: false,
        keywordsDetectadas: [],
        esRafaga: false,
        eliminado: false,
        creadoEn: "2026-07-10T10:00:00Z",
        fechaIncidente: "2026-07-10T10:00:00Z",
        ciudad: "Bogotá",
        pais: "Colombia",
        plataforma: { id: "plataforma-1", nombre: "WhatsApp", clave: "whatsapp" },
        usuario: { id: "usuario-1", email: "padre@example.com", nombre: "Padre" },
        clasificacion: null,
        operador: null,
        comite: null,
        ...overrides,
    };
}

function mockFetchConBandeja(reportes: unknown[], operadores: unknown[] = []) {
    return vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes("/api/plataformas")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ plataformas: [{ id: "plataforma-1", nombre: "WhatsApp" }] }),
            } as Response;
        }
        if (u.includes("/api/admin/operadores")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ operadores }),
            } as Response;
        }
        if (u.includes("/api/admin/reportes-revision")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({
                    reportes,
                    pagination: { page: 1, pageSize: 25, total: reportes.length, totalPages: 1 },
                }),
            } as Response;
        }
        return { ok: false, status: 404, json: async () => ({}) } as Response;
    });
}

describe("AdminReportesTable", () => {
    beforeEach(() => {
        searchParams = new URLSearchParams();
        pushMock.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("renderiza columna Operador y muestra Sin asignar", async () => {
        mockFetchConBandeja([reporteBase()]);

        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("RPT-TEST001")).toBeTruthy();
        });
        expect(screen.getByRole("columnheader", { name: "Operador" })).toBeTruthy();
        expect(screen.getByText("Sin asignar")).toBeTruthy();
    });

    it("muestra email del operador asignado", async () => {
        mockFetchConBandeja([
            reporteBase({
                operador: { id: "op-1", email: "operador@example.com", nombre: "Operador" },
            }),
        ]);

        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("operador@example.com")).toBeTruthy();
        });
    });

    it("muestra filtro de operador para ADMIN y propaga operadorId", async () => {
        const fetchMock = mockFetchConBandeja([reporteBase()], [
            { id: "op-1", email: "operador@example.com", nombre: "Operador", rol: "OPERADOR" },
        ]);

        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("operador@example.com")).toBeTruthy();
        });

        const select = screen.getByLabelText("Operador") as HTMLSelectElement;
        fireEvent.change(select, { target: { value: "op-1" } });

        const boton = screen.getByText("Aplicar filtros");
        fireEvent.click(boton);

        await waitFor(() => {
            expect(pushMock).toHaveBeenCalled();
        });

        const url = pushMock.mock.calls[0][0] as string;
        expect(url).toContain("operadorId=op-1");
    });

    it("no muestra filtro de operador para OPERADOR", async () => {
        mockFetchConBandeja([reporteBase()]);

        render(<AdminReportesTable rol="OPERADOR" />);

        await waitFor(() => {
            expect(screen.getByText("RPT-TEST001")).toBeTruthy();
        });
        expect(screen.queryByLabelText("Operador")).toBeNull();
    });
});
