import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ComiteEstadisticas } from "./ComiteEstadisticas";
import type { EstadisticasComiteDto } from "@/lib/dal/types/comite-convivencia";

function dtoBase(): EstadisticasComiteDto {
    return {
        casosPorEstado: { PENDIENTE: 1, RESUELTA: 3 },
        tiempoMedioResolucionDias: 8.2,
        topCategorias: [{ categoria: "EXTORSION", total: 2 }],
        distribucionEstado: [
            { estado: "RESUELTA", total: 3, pct: 75 },
            { estado: "PENDIENTE", total: 1, pct: 25 },
        ],
        tendenciaSemanal: [
            { semanaInicio: "2026-06-29", creados: 0, resueltos: 0 },
            { semanaInicio: "2026-07-06", creados: 0, resueltos: 0 },
            { semanaInicio: "2026-07-13", creados: 0, resueltos: 0 },
            { semanaInicio: "2026-07-20", creados: 0, resueltos: 0 },
            { semanaInicio: "2026-07-27", creados: 2, resueltos: 0 },
            { semanaInicio: "2026-08-03", creados: 0, resueltos: 2 },
            { semanaInicio: "2026-08-10", creados: 1, resueltos: 0 },
            { semanaInicio: "2026-08-17", creados: 1, resueltos: 1 },
        ],
        sla: { aTiempo: 2, vencidos: 1, sinSla: 1, pctATiempo: 67 },
        tiempoMedioPorCategoria: [
            { categoria: "EXTORSION", dias: 8.5, resueltos: 2 },
            { categoria: "SOLICITUD_ENCUENTRO", dias: 8, resueltos: 1 },
        ],
    };
}

/** SPEC-177: los 4 bloques nuevos se renderizan con los datos del DTO. */
describe("ComiteEstadisticas (SPEC-177)", () => {
    it("renderiza los 4 bloques nuevos con sus números", () => {
        render(<ComiteEstadisticas estadisticas={dtoBase()} />);

        const texto = document.body.textContent ?? "";
        // Tendencia semanal: 8 etiquetas de semana y leyenda.
        expect(screen.getByText("Tendencia semanal")).toBeTruthy();
        expect(texto.match(/\d{2}\/\d{2}/g)).toHaveLength(8);
        expect(texto).toContain("Nuevos");
        expect(texto).toContain("Resueltos");
        // SLA: conteos y porcentaje.
        expect(screen.getByText("Cumplimiento del SLA")).toBeTruthy();
        expect(texto).toContain("A tiempo");
        expect(texto).toContain("Vencidos");
        expect(texto).toContain("Sin fecha límite");
        expect(texto).toContain("67% de los casos con fecha límite se resolvieron a tiempo.");
        // Tiempo medio por categoría.
        expect(screen.getByText("Tiempo medio por categoría")).toBeTruthy();
        expect(texto).toContain("EXTORSION");
        expect(texto).toContain("8.5 días · 2 resueltos");
        expect(texto).toContain("8 días · 1 resuelto");
        // Distribución por estado con porcentaje.
        expect(texto).toContain("Resueltas");
        expect(texto).toContain("3 · 75%");
        expect(texto).toContain("1 · 25%");
        // Tooltips criollos presentes (botones de ayuda accesibles).
        expect(screen.getByLabelText("Qué significa a tiempo")).toBeTruthy();
        expect(screen.getByLabelText("Qué muestra la tendencia semanal")).toBeTruthy();
    });

    it("sin datos: muestra mensajes vacíos en vez de romperse", () => {
        const vacio = dtoBase();
        vacio.casosPorEstado = {};
        vacio.tiempoMedioResolucionDias = null;
        vacio.topCategorias = [];
        vacio.distribucionEstado = [];
        vacio.sla = { aTiempo: 0, vencidos: 0, sinSla: 0, pctATiempo: null };
        vacio.tiempoMedioPorCategoria = [];
        vacio.tendenciaSemanal = vacio.tendenciaSemanal.map((s) => ({ ...s, creados: 0, resueltos: 0 }));

        render(<ComiteEstadisticas estadisticas={vacio} />);

        const texto = document.body.textContent ?? "";
        expect(texto).toContain("Todavía no hay casos con fecha límite para medir el cumplimiento.");
        expect(texto).toContain("Todavía no hay casos resueltos.");
        expect(texto).toContain("Todavía no hay casos escalados.");
        expect(texto).toContain("Todavía no hay casos clasificados.");
    });
});
