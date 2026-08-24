/**
 * SPEC-211 (002-PI-111): tests de render del bloque 1 (resumen ejecutivo).
 * Sin BD ni fetch: el componente es puro sobre el DTO.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuscripcionResumen } from "./SuscripcionResumen";
import type { VistaSuscripcion } from "@/lib/pagos/suscripcion-vista.types";

function vistaBase(overrides: Partial<VistaSuscripcion> = {}): VistaSuscripcion {
    return {
        id: "sub-1",
        estado: "ACTIVA",
        esFreemium: false,
        diasRestantes: 120,
        fechaInicio: "2026-08-01T05:00:00.000Z",
        fechaFin: "2026-12-01T05:00:00.000Z",
        plan: { nombre: "Plan Colegio Anual", duracion: "MES_12", precioBaseUSD: 100 },
        totalPagadoUSD: 100,
        totalPagadoLocal: 400000,
        monedaLocal: "COP",
        codigoReferidoPropio: "PI-COLEGIO-X1",
        referidosExitososEsteAnio: 2,
        contratoPDFUrl: null,
        contratoObligatorio: true,
        pagoPendiente: null,
        pagos: [],
        opcionesRenovacion: [],
        limitesComprobante: { tamanoMaxMB: 10, formatosPermitidos: ["image/png"] },
        descuentoReferidoPct: 0,
        puedeRenovar: true,
        ...overrides,
    };
}

describe("SuscripcionResumen", () => {
    it("muestra plan, badge de estado, días restantes y total pagado", () => {
        render(<SuscripcionResumen vista={vistaBase()} />);
        expect(screen.getByTestId("bloque-resumen")).toBeDefined();
        expect(screen.getByText("Plan Colegio Anual")).toBeDefined();
        expect(screen.getByText("Activa")).toBeDefined();
        expect(screen.getByText("120 días restantes")).toBeDefined();
        expect(screen.getByText("Total pagado histórico")).toBeDefined();
    });

    it("muestra 'Vence hoy' cuando faltan 0 días", () => {
        render(<SuscripcionResumen vista={vistaBase({ diasRestantes: 0 })} />);
        expect(screen.getByText("Vence hoy")).toBeDefined();
    });

    it("muestra días de vencida cuando el conteo es negativo", () => {
        render(<SuscripcionResumen vista={vistaBase({ diasRestantes: -3, estado: "EN_GRACIA" })} />);
        expect(screen.getByText("Vencida hace 3 días")).toBeDefined();
        expect(screen.getByText("En periodo de gracia")).toBeDefined();
    });

    it("no muestra días restantes cuando está cancelada", () => {
        render(<SuscripcionResumen vista={vistaBase({ estado: "CANCELADA" })} />);
        expect(screen.getByText("Cancelada")).toBeDefined();
        expect(screen.queryByText(/días restantes/)).toBeNull();
    });

    it("muestra el aviso de periodo gratuito cuando es freemium", () => {
        render(<SuscripcionResumen vista={vistaBase({ esFreemium: true })} />);
        expect(screen.getByText(/periodo gratuito/)).toBeDefined();
    });
});
