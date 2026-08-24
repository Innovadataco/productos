/**
 * SPEC-227 (002-PI-128): tests de componente de HistorialRecomendaciones
 * (FR-009/010): render de estados/badges, KPIs con "—" sin resueltas, bloque
 * "Por regla" con la fila sobre umbral destacada ("revisar umbral") y estado
 * vacío neutral. Fetch mockeado (sin BD).
 */
import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { HistorialRecomendaciones } from "./HistorialRecomendaciones";

const REGLAS = [
    { id: "regla-1", clave: "vencimiento.T_menos_7", nombre: "Llamar a clientes que vencen esta semana", categoria: "renovacion" },
    { id: "regla-2", clave: "mora.T_mas_30", nombre: "Mora larga · sugerir bono de retención", categoria: "churn" },
];

const LISTA = {
    items: [
        {
            id: "rec-1",
            titulo: "Llama a Colegio Ejemplo · vence 2026-08-30",
            regla: { id: "regla-1", clave: "vencimiento.T_menos_7", nombre: "Llamar a clientes que vencen esta semana" },
            categoria: "renovacion",
            prioridad: 80,
            estado: "PENDIENTE",
            generadaEn: "2026-08-23T19:05:00.000Z",
            resueltaEn: null,
            ejecutadaAutomatica: false,
            sujetoTipo: "Suscripcion",
            sujetoId: "ck_sujeto_1",
        },
        {
            id: "rec-2",
            titulo: "Sugerir bono de retención",
            regla: { id: "regla-2", clave: "mora.T_mas_30", nombre: "Mora larga · sugerir bono de retención" },
            categoria: "churn",
            prioridad: 90,
            estado: "IGNORADA",
            generadaEn: "2026-08-20T14:00:00.000Z",
            resueltaEn: "2026-08-21T14:00:00.000Z",
            ejecutadaAutomatica: true,
            sujetoTipo: "Suscripcion",
            sujetoId: "ck_sujeto_2",
        },
    ],
    pagination: { page: 1, pageSize: 25, total: 2, totalPages: 1 },
};

const METRICAS: {
    rango: { desde: string | null; hasta: string | null };
    totalGeneradas: number;
    totalResueltas: number;
    pendientes: number;
    tasaAplicacionPct: number | null;
    tasaIgnoradaPct: number | null;
    tasaExpiradaPct: number | null;
    tiempoPromedioResolucionHoras: number | null;
    umbralAlertaIgnoradaPct: number;
    porRegla: {
        reglaId: string;
        reglaClave: string;
        reglaNombre: string;
        totalGeneradas: number;
        tasaAplicacionPct: number | null;
        tasaIgnoradaPct: number | null;
        tasaExpiradaPct: number | null;
        tiempoPromedioResolucionHoras: number | null;
        sobreUmbralAlerta: boolean;
    }[];
} = {
    rango: { desde: null, hasta: null },
    totalGeneradas: 13,
    totalResueltas: 10,
    pendientes: 3,
    tasaAplicacionPct: 20,
    tasaIgnoradaPct: 80,
    tasaExpiradaPct: 0,
    tiempoPromedioResolucionHoras: 31.2,
    umbralAlertaIgnoradaPct: 70,
    porRegla: [
        {
            reglaId: "regla-2",
            reglaClave: "mora.T_mas_30",
            reglaNombre: "Mora larga · sugerir bono de retención",
            totalGeneradas: 10,
            tasaAplicacionPct: 20,
            tasaIgnoradaPct: 80,
            tasaExpiradaPct: 0,
            tiempoPromedioResolucionHoras: 31.2,
            sobreUmbralAlerta: true,
        },
    ],
};

function mockFetch({ lista = LISTA, metricas = METRICAS, ok = true } = {}) {
    return vi.fn((input: RequestInfo | URL) => {
        const url = String(input);
        if (!ok) return Promise.resolve(new Response("{}", { status: 500 }));
        const cuerpo = url.includes("/metricas") ? metricas : lista;
        return Promise.resolve(
            new Response(JSON.stringify(cuerpo), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            })
        );
    });
}

describe("HistorialRecomendaciones", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", mockFetch());
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("renderiza la tabla con badges de estado y el distintivo 'ejecutada sola'", async () => {
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        expect(await screen.findByText("Llama a Colegio Ejemplo · vence 2026-08-30")).toBeTruthy();
        const tabla = within(screen.getByTestId("tabla-sugerencias"));
        expect(tabla.getByText("Pendiente")).toBeTruthy();
        expect(tabla.getByText("Ignorada")).toBeTruthy();
        expect(tabla.getByText("ejecutada sola")).toBeTruthy();
    });

    it("muestra los KPIs globales y destaca la tasa de ignorada sobre el umbral", async () => {
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        await waitFor(() => expect(screen.getByTestId("kpi-total").textContent).toContain("13"));
        expect(screen.getByTestId("kpi-tasa-aplicacion").textContent).toContain("20%");
        expect(screen.getByTestId("kpi-tasa-ignorada").textContent).toContain("80%");
        expect(screen.getByTestId("kpi-tiempo-promedio").textContent).toContain("31.2 h");
    });

    it("destaca en el bloque Por regla la fila sobre el umbral con 'revisar umbral'", async () => {
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        const fila = await screen.findByTestId("fila-regla-alerta");
        expect(fila.textContent).toContain("Mora larga · sugerir bono de retención");
        expect(fila.textContent).toContain("revisar umbral");
    });

    it("muestra '—' en las tasas cuando no hay resueltas (sin división por cero)", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({
                metricas: {
                    ...METRICAS,
                    totalGeneradas: 3,
                    totalResueltas: 0,
                    pendientes: 3,
                    tasaAplicacionPct: null,
                    tasaIgnoradaPct: null,
                    tasaExpiradaPct: null,
                    tiempoPromedioResolucionHoras: null,
                    porRegla: [],
                },
            })
        );
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        await waitFor(() => expect(screen.getByTestId("kpi-tasa-aplicacion").textContent).toContain("—"));
        expect(screen.getByTestId("kpi-tasa-ignorada").textContent).toContain("—");
        expect(screen.getByTestId("kpi-tiempo-promedio").textContent).toContain("—");
    });

    it("muestra el estado vacío neutral cuando el filtro no tiene resultados", async () => {
        vi.stubGlobal(
            "fetch",
            mockFetch({ lista: { items: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } } })
        );
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        expect(
            await screen.findByText("No hay sugerencias para los filtros seleccionados.")
        ).toBeTruthy();
    });

    it("muestra alerta de error cuando la carga falla", async () => {
        vi.stubGlobal("fetch", mockFetch({ ok: false }));
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        expect(await screen.findByText("No se pudo cargar el historial. Intenta de nuevo.")).toBeTruthy();
    });

    it("el botón Exportar CSV apunta al endpoint con los filtros", async () => {
        render(<HistorialRecomendaciones reglas={REGLAS} />);

        await screen.findByTestId("tabla-sugerencias");
        const enlace = screen.getByText("Exportar CSV").closest("a");
        expect(enlace?.getAttribute("href")).toBe("/api/admin/analisis/recomendaciones/export");
    });
});
