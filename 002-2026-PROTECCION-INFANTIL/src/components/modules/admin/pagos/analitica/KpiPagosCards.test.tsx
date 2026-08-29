/**
 * SPEC-218 (002-PI-118): tests unitarios de la fila de KPIs del dashboard
 * dinero-vs-valor (sin BD).
 */
import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiPagosCards } from "./KpiPagosCards";
import type { KpiPagosDto } from "@/lib/pagos/analitica.service";

function kpiDto(overrides: Partial<KpiPagosDto> = {}): KpiPagosDto {
    return {
        recaudoMesActualUSD: 1500,
        recaudoMesAnteriorUSD: 1200,
        variacionRecaudoPct: 25,
        activas: 45,
        enGracia: 5,
        suspendidas: 3,
        canceladas: 2,
        nuevasEsteMes: 8,
        renovacionesEsteMes: 12,
        ticketPromedioUSD: 75,
        ltvUSD: 225,
        conversionFreemiumPct: 60,
        tasaReferidosPct: 20,
        ...overrides,
    };
}

describe("KpiPagosCards", () => {
    it("renderiza los KPIs del BRIEF §9.2", () => {
        render(<KpiPagosCards kpi={kpiDto()} />);
        expect(screen.getByText("Recaudo del mes")).toBeTruthy();
        expect(screen.getByText("Suscripciones activas")).toBeTruthy();
        expect(screen.getByText("45")).toBeTruthy();
        expect(screen.getByText("Ticket promedio")).toBeTruthy();
        expect(screen.getByText("LTV por cliente")).toBeTruthy();
        expect(screen.getByText("Conversión freemium")).toBeTruthy();
        expect(screen.getByText("60%")).toBeTruthy();
        expect(screen.getByText("Tasa de referidos")).toBeTruthy();
        expect(screen.getByText("+25% vs mes anterior")).toBeTruthy();
    });

    it("muestra guiones defensivos cuando no hay datos", () => {
        render(
            <KpiPagosCards
                kpi={kpiDto({
                    variacionRecaudoPct: null,
                    ticketPromedioUSD: null,
                    ltvUSD: null,
                    conversionFreemiumPct: null,
                    tasaReferidosPct: null,
                })}
            />
        );
        expect(screen.queryByText(/vs mes anterior$/)).toBeNull();
        // Los 4 KPIs sin valor muestran "—".
        expect(screen.getAllByText("—").length).toBe(4);
    });

    it("marca la variación negativa", () => {
        render(<KpiPagosCards kpi={kpiDto({ variacionRecaudoPct: -15 })} />);
        expect(screen.getByText("-15% vs mes anterior")).toBeTruthy();
    });
});
