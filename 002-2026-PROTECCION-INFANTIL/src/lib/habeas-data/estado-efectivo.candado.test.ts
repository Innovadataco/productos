/**
 * CANDADO · SPEC-772 — el estado efectivo de una solicitud de habeas data NO miente sobre el reloj:
 * resolver DESPUÉS de `venceEn` es `RESUELTA_TARDE` (incumplimiento), no `RESUELTA_A_TIEMPO`. Y
 * `esIncumplimiento` es FUENTE ÚNICA (D-4): el resumen y el detalle la leen igual (acá se prueba
 * que coincide con `estadoEfectivoSolicitud` en TODOS los casos — no dos criterios).
 *
 * Control positivo por MUTACIÓN, dos direcciones. Falla hacia el INCUMPLIMIENTO (conservador):
 * dato ausente/basura se cuenta como incumplida, nunca como «al día». `now` inyectado. Unit puro.
 */
import { describe, it, expect } from "vitest";
import { estadoEfectivoSolicitud, esIncumplimiento, type EstadoEfectivoSolicitud } from "./estado-efectivo";

const DIA = 24 * 60 * 60 * 1000;
const VENCE = Date.parse("2026-10-15T17:00:00.000Z");

// Verdad única: `esIncumplimiento` == (estado ∈ {tardía, vencida}). Se verifica en cada caso.
function coherente(venceEn: unknown, resueltaEn: unknown, now: unknown): EstadoEfectivoSolicitud {
    const e = estadoEfectivoSolicitud(venceEn as never, resueltaEn as never, now as never);
    const incumple = esIncumplimiento(venceEn as never, resueltaEn as never, now as never);
    expect(incumple, `esIncumplimiento debe coincidir con el estado ${e}`).toBe(e === "VENCIDA_SIN_RESOLVER" || e === "RESUELTA_TARDE");
    return e;
}

describe("SPEC-772 · estadoEfectivoSolicitud — el estado no miente sobre el reloj", () => {
    it("resuelta ANTES de vencer → RESUELTA_A_TIEMPO (no incumple)", () => {
        expect(coherente(VENCE, VENCE - DIA, VENCE + 5 * DIA)).toBe("RESUELTA_A_TIEMPO");
    });

    it("resuelta DESPUÉS de vencer → RESUELTA_TARDE (incumple) — el defecto que se caza", () => {
        // Mutación implícita: un criterio que contara «resuelta» a secas la daría por cumplida.
        expect(coherente(VENCE, VENCE + DIA, VENCE + 2 * DIA)).toBe("RESUELTA_TARDE");
    });

    it("resuelta EXACTO en el vencimiento → a tiempo (frontera ≤)", () => {
        expect(coherente(VENCE, VENCE, VENCE)).toBe("RESUELTA_A_TIEMPO");
    });

    it("abierta y aún en término (now < venceEn) → EN_TERMINO (no incumple)", () => {
        expect(coherente(VENCE, null, VENCE - DIA)).toBe("EN_TERMINO");
    });

    it("abierta y pasado el término (now ≥ venceEn) → VENCIDA_SIN_RESOLVER (incumple)", () => {
        expect(coherente(VENCE, null, VENCE + DIA)).toBe("VENCIDA_SIN_RESOLVER");
        expect(coherente(VENCE, null, VENCE)).toBe("VENCIDA_SIN_RESOLVER"); // frontera now≥vence
    });

    // ── Fallo CONSERVADOR: dato ausente/basura → incumplimiento, nunca «al día» ──
    it("resuelta con venceEn ausente/basura → RESUELTA_TARDE (no se regala «a tiempo»)", () => {
        expect(coherente(null, VENCE, VENCE)).toBe("RESUELTA_TARDE");
        expect(coherente("no-es-fecha", VENCE, VENCE)).toBe("RESUELTA_TARDE");
    });

    it("abierta con now o venceEn ausente/basura → VENCIDA_SIN_RESOLVER (no esconde el problema)", () => {
        expect(coherente(VENCE, null, null)).toBe("VENCIDA_SIN_RESOLVER");
        expect(coherente(null, null, VENCE)).toBe("VENCIDA_SIN_RESOLVER");
        expect(coherente("basura", null, "basura")).toBe("VENCIDA_SIN_RESOLVER");
    });

    it("acepta Date, ISO string y epoch ms (entrada tolerante)", () => {
        expect(coherente(new Date(VENCE), new Date(VENCE - DIA), new Date(VENCE))).toBe("RESUELTA_A_TIEMPO");
        expect(coherente("2026-10-15T17:00:00.000Z", "2026-10-16T17:00:00.000Z", "2026-10-16T17:00:00.000Z")).toBe("RESUELTA_TARDE");
    });
});
