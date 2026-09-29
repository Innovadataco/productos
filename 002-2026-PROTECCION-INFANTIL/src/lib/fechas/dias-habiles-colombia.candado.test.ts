/**
 * SPEC-768 · CANDADO de los días hábiles de Colombia.
 *
 * Cubre lo que exigió el CEO: (1) el ancla en FIN DE SEMANA no vence en fin de
 * semana (el caso que destapó el bug de tipos: sáb 3-ene → NO sábado); (2) el día
 * del ancla no cuenta y el conteo arranca el siguiente hábil; (3) los festivos
 * cuentan (corren el vencimiento); (4) `venceEn` cae SIEMPRE en día hábil y al FIN
 * del día (23:59:59.999 Bogotá) — el borde legal del 15.º día; (5) control positivo
 * en las dos direcciones de `diasHabilesTranscurridos`.
 */
import { describe, it, expect } from "vitest";
import { formatInTimeZone } from "date-fns-tz";
import {
    sumarDiasHabilesColombia,
    diasHabilesTranscurridosColombia,
    esDiaHabilColombia,
    diaBogota,
} from "@/lib/fechas/dias-habiles-colombia";

const horaBogota = (d: Date) => formatInTimeZone(d, "America/Bogota", "HH:mm:ss.SSS");

describe("SPEC-768 · días hábiles de Colombia", () => {
    it("ancla en SÁBADO no vence en fin de semana; +15 desde sáb 3-ene-2026 → lun 26-ene (con festivos)", () => {
        // El OLD daba sábado 24 (bug de tipos). Mon-Fri-only daría vie 23; con el
        // festivo Reyes (lun 12) el 15.º hábil real es lun 26. Se prueba el valor
        // CORRECTO con festivos, y que NO cae en fin de semana.
        const venceEn = sumarDiasHabilesColombia(new Date("2026-01-03T10:00:00Z"), 15);
        expect(diaBogota(venceEn)).toBe("2026-01-26");
        expect(esDiaHabilColombia(venceEn), "nunca vence en fin de semana").toBe(true);
    });

    it("el día del ancla NO cuenta y el conteo arranca el siguiente hábil (ancla lunes)", () => {
        // Feb-2026 sin festivos: lun 2 (ancla, no cuenta) → mar 3 es el día 1.
        const dia1 = sumarDiasHabilesColombia(new Date("2026-02-02T10:00:00Z"), 1);
        expect(diaBogota(dia1)).toBe("2026-02-03");
        // +5 hábiles limpios → lun 9.
        expect(diaBogota(sumarDiasHabilesColombia(new Date("2026-02-02T10:00:00Z"), 5))).toBe("2026-02-09");
    });

    it("un festivo dentro de la ventana corre el vencimiento (+5 desde lun 5-ene cruza Reyes 12 → mar 13, no lun 12)", () => {
        expect(diaBogota(sumarDiasHabilesColombia(new Date("2026-01-05T10:00:00Z"), 5))).toBe("2026-01-13");
    });

    it("venceEn cae SIEMPRE en día hábil y al FIN del día (23:59:59.999 Bogotá)", () => {
        for (const [ancla, n] of [["2026-01-03T10:00:00Z", 15], ["2026-02-02T18:30:00Z", 7], ["2026-12-24T05:00:00Z", 3]] as const) {
            const v = sumarDiasHabilesColombia(new Date(ancla), n);
            expect(esDiaHabilColombia(v), `ancla ${ancla}`).toBe(true);
            expect(horaBogota(v), `ancla ${ancla}`).toBe("23:59:59.999");
            expect(v.getTime(), `venceEn > ancla (${ancla})`).toBeGreaterThan(new Date(ancla).getTime());
        }
    });

    it("diasHabilesTranscurridos: excluye festivos y el día de inicio (5-ene→14-ene cruza Reyes = 6, no 7)", () => {
        const desde = new Date("2026-01-05T10:00:00Z");
        expect(diasHabilesTranscurridosColombia(desde, new Date("2026-01-14T10:00:00Z"))).toBe(6);
        // mismo día o anterior → 0.
        expect(diasHabilesTranscurridosColombia(desde, desde)).toBe(0);
        expect(diasHabilesTranscurridosColombia(desde, new Date("2026-01-04T10:00:00Z"))).toBe(0);
    });

    it("esDiaHabilColombia: sábado/domingo/festivo = false; hábil = true", () => {
        expect(esDiaHabilColombia(new Date("2026-01-03T10:00:00Z"))).toBe(false); // sábado
        expect(esDiaHabilColombia(new Date("2026-01-04T10:00:00Z"))).toBe(false); // domingo
        expect(esDiaHabilColombia(new Date("2026-01-12T10:00:00Z"))).toBe(false); // Reyes (festivo)
        expect(esDiaHabilColombia(new Date("2026-01-13T10:00:00Z"))).toBe(true); // martes hábil
    });
});
