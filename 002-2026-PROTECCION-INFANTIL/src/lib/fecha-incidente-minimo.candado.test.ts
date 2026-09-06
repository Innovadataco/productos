/**
 * SPEC-563 (Jelkin) · CANDADO: la fecha del incidente admite ENTRE hace 2 años y
 * hoy. La barrera es el servidor (`fechaIncidenteSchema`, fuente única — SPEC-513).
 *
 * Los dos bordes, con reloj CONGELADO (el borde «exactamente 2 años atrás» depende
 * del reloj de pared: si el test y el schema leen `new Date()` en instantes
 * distintos, el día justo bailaría entre válido y no — misma familia que SPEC-554.
 * Congelar el tiempo lo hace determinista, no se afloja la aserción).
 *
 * Integración por el glob src/** (no toca vitest.unit.includes.ts): es puro.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { fechaIncidenteSchema } from "./validators";

const AHORA = new Date("2026-09-06T12:00:00.000Z");
const ok = (iso: string) => fechaIncidenteSchema.safeParse(iso).success;

afterEach(() => vi.useRealTimers());

describe("SPEC-563 · fechaIncidente entre hace 2 años y hoy", () => {
    it("los dos bordes + el centro (reloj congelado)", () => {
        vi.useFakeTimers();
        vi.setSystemTime(AHORA);

        // hoy → válido
        expect(ok("2026-09-06T12:00:00.000Z")).toBe(true);
        // exactamente 2 años atrás → VÁLIDO (el día justo entra)
        expect(ok("2024-09-06T12:00:00.000Z")).toBe(true);
        // un día más viejo que 2 años → RECHAZA
        expect(ok("2024-09-05T12:00:00.000Z")).toBe(false);
        // mucho más viejo (2010) → RECHAZA (el caso que motivó la SPEC)
        expect(ok("2010-01-01T00:00:00.000Z")).toBe(false);
        // futuro → RECHAZA (borde que ya existía, sigue vivo)
        expect(ok("2026-09-07T12:00:00.000Z")).toBe(false);
        // dentro de la ventana (hace 1 año) → válido
        expect(ok("2025-09-06T12:00:00.000Z")).toBe(true);
    });
});
