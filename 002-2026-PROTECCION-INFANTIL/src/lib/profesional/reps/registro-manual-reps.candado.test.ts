/**
 * CANDADO · SPEC-790 (T6) · la compuerta de código del registro manual REPS. Espejo del CHECK de la base
 * (`VIGENTE⟹vigenteHasta`) MÁS los guardas que el CHECK no puede expresar, devolviendo un CÓDIGO de motivo
 * (no copy). Puro, sin base. El CHECK es la red; esto es la puerta.
 */
import { describe, it, expect } from "vitest";
import { validarRegistroManualReps } from "./registro-manual-reps";

const AHORA = new Date("2026-06-15T12:00:00Z");
const DIA = 24 * 60 * 60 * 1000;
const FUT = new Date(AHORA.getTime() + 90 * DIA);
const PAS = new Date(AHORA.getTime() - DIA);

describe("SPEC-790 (T6) · validarRegistroManualReps", () => {
    it("VIGENTE sin vigenteHasta → VIGENTE_SIN_VIGENCIA (espejo del CHECK, antes de la base)", () => {
        expect(validarRegistroManualReps({ resultado: "VIGENTE", vigenteHasta: null, modalidades: ["PRESENCIAL"] }, AHORA)).toEqual({
            ok: false,
            motivo: "VIGENTE_SIN_VIGENCIA",
        });
    });

    it("VIGENTE con vigencia ya pasada → VIGENTE_VIGENCIA_PASADA (lo que el CHECK no alcanza)", () => {
        expect(validarRegistroManualReps({ resultado: "VIGENTE", vigenteHasta: PAS, modalidades: ["PRESENCIAL"] }, AHORA)).toEqual({
            ok: false,
            motivo: "VIGENTE_VIGENCIA_PASADA",
        });
    });

    it("VIGENTE sin modalidades → VIGENTE_SIN_MODALIDAD (una habilitación vigente cubre al menos una)", () => {
        expect(validarRegistroManualReps({ resultado: "VIGENTE", vigenteHasta: FUT, modalidades: [] }, AHORA)).toEqual({
            ok: false,
            motivo: "VIGENTE_SIN_MODALIDAD",
        });
    });

    it("VIGENTE completo (fecha futura + ≥1 modalidad) → ok", () => {
        expect(validarRegistroManualReps({ resultado: "VIGENTE", vigenteHasta: FUT, modalidades: ["PRESENCIAL", "TELEMEDICINA"] }, AHORA)).toEqual({ ok: true });
    });

    it("VENCIDA / NO_ENCONTRADA / SIN_VERIFICAR → ok sin fecha ni modalidades (no aplican)", () => {
        for (const resultado of ["VENCIDA", "NO_ENCONTRADA", "SIN_VERIFICAR"] as const) {
            expect(validarRegistroManualReps({ resultado, vigenteHasta: null, modalidades: [] }, AHORA)).toEqual({ ok: true });
        }
    });
});
