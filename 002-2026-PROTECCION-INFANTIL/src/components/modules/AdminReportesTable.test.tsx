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

function mockFetchConBandeja(reportes: unknown[], operadores: unknown[] = [], detalle: unknown = null) {
    return vi.spyOn(global, "fetch").mockImplementation(async (url) => {
        const u = String(url);
        if (detalle && u.includes("/api/admin/reportes-revision/reporte-")) {
            return {
                ok: true,
                status: 200,
                json: async () => ({ reporte: detalle }),
            } as Response;
        }
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
                    secciones: { pendientes: reportes.length, procesados: 0 },
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

    // ── SPEC-595: separación pendientes / procesados ─────────────────────────

    it("muestra las pestañas con contadores y abre en Pendientes por defecto", async () => {
        mockFetchConBandeja([reporteBase()]);

        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("RPT-TEST001")).toBeTruthy();
        });

        const tabPendientes = screen.getByRole("tab", { name: /Pendientes/ });
        const tabProcesados = screen.getByRole("tab", { name: /Procesados/ });
        expect(tabPendientes.getAttribute("aria-selected")).toBe("true");
        expect(tabProcesados.getAttribute("aria-selected")).toBe("false");
        // La bandeja se carga sin «seccion» en la URL → default pendientes.
        expect(pushMock).not.toHaveBeenCalled();
    });

    it("al cambiar a Procesados navega con seccion=procesados y reinicia página", async () => {
        mockFetchConBandeja([reporteBase()]);

        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("RPT-TEST001")).toBeTruthy();
        });

        fireEvent.click(screen.getByRole("tab", { name: /Procesados/ }));

        await waitFor(() => {
            expect(pushMock).toHaveBeenCalled();
        });
        const url = pushMock.mock.calls[0][0] as string;
        expect(url).toContain("seccion=procesados");
        expect(url).toContain("page=1");
    });

    it("en Procesados no ofrece «Ver proceso» y solo permite «Ver detalle» solo-lectura", async () => {
        // El detalle solo-lectura hace su propio fetch; se sirve con `detalle`.
        mockFetchConBandeja([reporteBase({ estado: "CORREGIDO" })], [], detalleProcesado());

        searchParams = new URLSearchParams("seccion=procesados");
        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("RPT-TEST001")).toBeTruthy();
        });

        // Aviso de solo visualización y sin acción «Ver proceso».
        expect(screen.getByText(/solo visualización/i)).toBeTruthy();
        expect(screen.queryByText("Ver proceso")).toBeNull();

        fireEvent.click(screen.getByText("Ver detalle"));

        // El modal solo-lectura abre con su título y la estructura de campos.
        await waitFor(() => {
            expect(screen.getByText("Detalle del reporte — solo visualización")).toBeTruthy();
        });
        expect(screen.getByText("RPT-PROCES01")).toBeTruthy();
        expect(screen.getByText("Clasificación IA")).toBeTruthy();
        expect(screen.getByText("Historial de intentos de procesamiento")).toBeTruthy();
        // Sin acciones del detalle editable.
        expect(screen.queryByText("Confirmar clasificación")).toBeNull();
        expect(screen.queryByText(/Revelar original/i)).toBeNull();
    });

    it("en Pendientes mantiene «Ver proceso» y no muestra el aviso de solo visualización", async () => {
        mockFetchConBandeja([reporteBase()]);

        render(<AdminReportesTable rol="ADMIN" />);

        await waitFor(() => {
            expect(screen.getByText("RPT-TEST001")).toBeTruthy();
        });

        expect(screen.getByText("Ver proceso")).toBeTruthy();
        expect(screen.queryByText(/solo visualización/i)).toBeNull();
    });
});

function detalleProcesado() {
    return {
        id: "reporte-123",
        identificador: "+57300TEST000",
        numeroSeguimiento: "RPT-PROCES01",
        estado: "CORREGIDO",
        esAnonimo: false,
        prioridadAlta: false,
        keywordsDetectadas: [],
        esRafaga: false,
        eliminado: false,
        motivoBaja: null,
        notaBaja: null,
        eliminadoEn: null,
        creadoEn: "2026-07-10T10:00:00Z",
        fechaIncidente: "2026-07-10T10:00:00Z",
        ciudad: "Bogotá",
        pais: "Colombia",
        plataforma: { nombre: "WhatsApp", clave: "whatsapp" },
        texto: "Texto anonimizado del reporte.",
        clasificacion: {
            categoria: "CONTACTO_INSISTENTE",
            confianza: 0.8,
            contienePii: false,
            piiDetectada: [],
            modeloUsado: "ornith:9b",
            latenciaMs: 1200,
            categoriasSecundarias: [],
            posibleAgresorPar: false,
            correccion: {
                categoriaOriginal: "CONTACTO_INSISTENTE",
                categoriaCorregida: "CONTACTO_INSISTENTE",
                motivo: null,
                creadoEn: "2026-07-10T11:00:00Z",
            },
        },
        reintentos: [
            {
                id: "reintento-1",
                intento: 1,
                exitoso: true,
                error: null,
                creadoEn: "2026-07-10T10:05:00Z",
            },
        ],
    };
}
