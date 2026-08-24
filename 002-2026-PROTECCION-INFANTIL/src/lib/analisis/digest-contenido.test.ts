/**
 * SPEC-223 (002-PI-124): tests de la lógica pura del contenido del digest —
 * sin BD (registrado en vitest.unit.includes.ts).
 */
import { describe, expect, it } from "vitest";
import {
    calcularDeltas,
    formatearNumero,
    generarRecomendacionesSistema,
    parsearDestinatariosEmails,
    renderAnomalias,
    renderGanadoresPerdedores,
    renderRecomendacionesSistema,
    renderTablaKpis,
    renderTop5,
    type KpisSemana,
} from "./digest-contenido";

const KPIS_BASE: KpisSemana = {
    recaudoUSD: 1200,
    recaudoCOP: 4800000,
    nuevas: 3,
    canceladas: 1,
    churnRate: 0.02,
    scorePromedio: 61.5,
};

describe("formatearNumero", () => {
    it("separa miles estilo es-CO y redondea", () => {
        expect(formatearNumero(12345)).toBe("12.345");
        expect(formatearNumero(0)).toBe("0");
        expect(formatearNumero(999.4)).toBe("999");
    });
});

describe("parsearDestinatariosEmails", () => {
    it("separa por comas, recorta y clasifica válidos e inválidos", () => {
        const r = parsearDestinatariosEmails(" ceo@pi.co , equipo@pi.co,correo-malo, ,sin-arroba ");
        expect(r.validos).toEqual(["ceo@pi.co", "equipo@pi.co"]);
        expect(r.invalidos).toEqual(["correo-malo", "sin-arroba"]);
    });

    it("texto vacío → sin destinatarios ni inválidos", () => {
        expect(parsearDestinatariosEmails("   ")).toEqual({ validos: [], invalidos: [] });
    });
});

describe("calcularDeltas", () => {
    it("delta absoluto para montos/conteos y puntos porcentuales (fracción) para churn", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 1000, nuevas: 5, churnRate: 0.05 };
        const d = calcularDeltas(KPIS_BASE, previa);
        expect(d.recaudoUSD).toBe(200);
        expect(d.nuevas).toBe(-2);
        expect(d.churnRate).toBeCloseTo(-0.03, 10);
        expect(d.scorePromedio).toBeCloseTo(0, 10);
    });

    it("null cuando la métrica falta en cualquiera de las dos semanas", () => {
        const previa: KpisSemana = { ...KPIS_BASE, churnRate: null, scorePromedio: null };
        const d = calcularDeltas({ ...KPIS_BASE, churnRate: null }, previa);
        expect(d.churnRate).toBeNull();
        expect(d.scorePromedio).toBeNull();
        expect(d.recaudoUSD).toBe(0);
    });
});

describe("renderTop5", () => {
    it("lista numerada con acción sugerida cuando existe", () => {
        const out = renderTop5([
            { titulo: "Renovar Colegio San José", descripcion: "Vence en 7 días", accion: "Llamar al rector" },
            { titulo: "Cobrar renovación", descripcion: "Pago reportado hace 5 días", accion: null },
        ]);
        expect(out).toContain("1. **Renovar Colegio San José** — Vence en 7 días");
        expect(out).toContain("   Acción sugerida: Llamar al rector");
        expect(out).toContain("2. **Cobrar renovación** — Pago reportado hace 5 días");
        expect(out).not.toContain("2. **Cobrar renovación** — Pago reportado hace 5 días\n   Acción");
    });

    it("vacío → mensaje explícito", () => {
        expect(renderTop5([])).toBe("Sin decisiones pendientes esta semana.");
    });
});

describe("renderTablaKpis", () => {
    it("incluye las 5 métricas con deltas y '—' para valores nulos", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 1000, scorePromedio: null };
        const deltas = calcularDeltas(KPIS_BASE, previa);
        const out = renderTablaKpis({ ...KPIS_BASE, scorePromedio: null }, deltas);
        expect(out).toContain("- Recaudo: US$ 1.200 (+200)");
        expect(out).toContain("$ 4.800.000 COP");
        expect(out).toContain("- Suscripciones nuevas: 3 (0)");
        expect(out).toContain("- Churn rate: 2,0%");
        expect(out).toContain("- Score promedio de valor: — (sin base)");
    });
});

describe("renderAnomalias", () => {
    it("vacío → 'Sin anomalías esta semana' (SPEC-225 opcional)", () => {
        expect(renderAnomalias([])).toBe("Sin anomalías esta semana.");
    });

    it("lista con severidad", () => {
        expect(renderAnomalias([{ severidad: "ALTA", descripcion: "Crecimiento anómalo en Cali" }])).toBe(
            "- [ALTA] Crecimiento anómalo en Cali"
        );
    });
});

describe("renderGanadoresPerdedores", () => {
    it("sin snapshots → mensaje explícito", () => {
        expect(renderGanadoresPerdedores([], [])).toContain("Sin snapshots de score");
    });

    it("top 3 y bottom 3 con nombre del cliente", () => {
        const out = renderGanadoresPerdedores(
            [
                { nombre: "Colegio A", scoreTotal: 90 },
                { nombre: "Colegio B", scoreTotal: 80 },
            ],
            [{ nombre: "Padre C", scoreTotal: 12.34 }]
        );
        expect(out).toContain("Ganadores (top 3):\n1. Colegio A — 90,0\n2. Colegio B — 80,0");
        expect(out).toContain("Perdedores (bottom 3):\n1. Padre C — 12,3");
    });
});

describe("generarRecomendacionesSistema", () => {
    it("crecimiento sobre el umbral → recomendación de replicar", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 800, canceladas: 0 };
        const r = generarRecomendacionesSistema({ ...KPIS_BASE, recaudoUSD: 1200, canceladas: 0 }, previa, 25);
        expect(r.some((x) => x.includes("creció 50%"))).toBe(true);
    });

    it("caída sobre el umbral → recomendación de revisar renovaciones", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 2000, canceladas: 0 };
        const r = generarRecomendacionesSistema({ ...KPIS_BASE, recaudoUSD: 1000, canceladas: 0 }, previa, 25);
        expect(r.some((x) => x.includes("cayó 50%"))).toBe(true);
    });

    it("más canceladas que nuevas → priorizar retención", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 0 };
        const r = generarRecomendacionesSistema({ ...KPIS_BASE, nuevas: 1, canceladas: 3 }, previa, 25);
        expect(r.some((x) => x.includes("priorizar retención"))).toBe(true);
    });

    it("sin snapshots de score → verificar el worker de score", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 0 };
        const r = generarRecomendacionesSistema({ ...KPIS_BASE, scorePromedio: null, nuevas: 2, canceladas: 0 }, previa, 25);
        expect(r.some((x) => x.includes("worker de score"))).toBe(true);
    });

    it("sin alertas → mensaje neutral", () => {
        const previa: KpisSemana = { ...KPIS_BASE, recaudoUSD: 1200 };
        expect(generarRecomendacionesSistema(KPIS_BASE, previa, 25)).toEqual([
            "Sin alertas operativas: la semana va dentro de los parámetros.",
        ]);
    });
});

describe("renderRecomendacionesSistema", () => {
    it("viñetas Markdown", () => {
        expect(renderRecomendacionesSistema(["Uno", "Dos"])).toBe("- Uno\n- Dos");
    });
});
