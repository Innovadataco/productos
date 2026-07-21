import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TablaResultadosSimulacion } from "./TablaResultadosSimulacion";
import type { ResultadoCaso } from "./types";

const mockAdminReporteDetalle = vi.fn();

vi.mock("@/components/modules/AdminReporteDetalle", () => ({
    AdminReporteDetalle: (props: { reporteId: string; onClose: () => void; onRefresh: () => void }) => {
        mockAdminReporteDetalle(props);
        return (
            <div data-testid="admin-reporte-detalle">
                <span data-testid="detalle-reporte-id">{props.reporteId}</span>
                <button data-testid="detalle-close" onClick={props.onClose}>
                    Cerrar
                </button>
            </div>
        );
    },
}));

function resultadoBase(overrides?: Partial<ResultadoCaso>): ResultadoCaso {
    return {
        indice: 1,
        identificador: "SIM-DET-1",
        reporteId: "reporte-1",
        estado: "CLASIFICADO",
        categoriaEsperada: "SOLICITUD_MATERIAL",
        categoriaAsignada: "SOLICITUD_MATERIAL",
        confianza: 0.92,
        latenciaMs: 120,
        modeloUsado: "ornith:9b",
        acierto: true,
        ...overrides,
    };
}

describe("TablaResultadosSimulacion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("muestra el mensaje de vacío cuando no hay resultados", () => {
        render(<TablaResultadosSimulacion resultados={[]} />);
        expect(screen.getByText("No hay resultados disponibles todavía.")).toBeTruthy();
    });

    it("renderiza una fila por resultado con el botón Ver detalle", () => {
        const resultados = [resultadoBase()];
        render(<TablaResultadosSimulacion resultados={resultados} />);

        expect(screen.getByText("SIM-DET-1")).toBeTruthy();
        expect(screen.getByTestId("ver-detalle-1")).toBeTruthy();
        expect(screen.getByText("Ver detalle")).toBeTruthy();
    });

    it("abre AdminReporteDetalle con el reporteId correcto al hacer clic", () => {
        const resultados = [
            resultadoBase({ indice: 1, reporteId: "reporte-abc", identificador: "SIM-ABC" }),
            resultadoBase({ indice: 2, reporteId: "reporte-def", identificador: "SIM-DEF" }),
        ];
        render(<TablaResultadosSimulacion resultados={resultados} />);

        fireEvent.click(screen.getByTestId("ver-detalle-2"));

        expect(screen.getByTestId("admin-reporte-detalle")).toBeTruthy();
        expect(screen.getByTestId("detalle-reporte-id").textContent).toBe("reporte-def");
    });

    it("cierra el detalle al invocar onClose", () => {
        const resultados = [resultadoBase()];
        render(<TablaResultadosSimulacion resultados={resultados} />);

        fireEvent.click(screen.getByTestId("ver-detalle-1"));
        expect(screen.getByTestId("admin-reporte-detalle")).toBeTruthy();

        fireEvent.click(screen.getByTestId("detalle-close"));
        expect(screen.queryByTestId("admin-reporte-detalle")).toBeNull();
    });

    it("pasa onRefresh igual a onClose", () => {
        const resultados = [resultadoBase()];
        render(<TablaResultadosSimulacion resultados={resultados} />);

        fireEvent.click(screen.getByTestId("ver-detalle-1"));

        const lastCall = mockAdminReporteDetalle.mock.calls[mockAdminReporteDetalle.mock.calls.length - 1][0];
        expect(typeof lastCall.onRefresh).toBe("function");
        expect(typeof lastCall.onClose).toBe("function");
    });
});
