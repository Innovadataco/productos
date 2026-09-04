/**
 * SPEC-438 · la franja aproximada cae donde el reportante dijo — en Bogotá.
 *
 * Es el mismo error que costó I-247 b: calcular la franja sobre UTC hacía que
 * la noche entera llegara al modelo como madrugada. Acá se prueba al revés:
 * que «noche» siga siendo noche cuando el analizador la lea en hora local.
 */
import { describe, it, expect } from "vitest";
import { instanteDeFranja, HORA_REPRESENTATIVA, FRANJAS, esFranja } from "./franja-aproximada";

/** La hora de Bogotá de un instante, sin depender de la zona del runner. */
function horaBogota(d: Date): number {
    return Number.parseInt(
        new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: "America/Bogota",
        }).format(d),
        10,
    ) % 24;
}

describe("SPEC-438 · la franja elegida cae en la hora de Bogotá que dice", () => {
    it.each(FRANJAS)("«%s» cae en su hora representativa local", (franja) => {
        const d = instanteDeFranja("2026-09-04", franja);
        expect(horaBogota(d)).toBe(HORA_REPRESENTATIVA[franja]);
    });

    it("el DÍA local se respeta: «madrugada» no se corre al día anterior", () => {
        const d = instanteDeFranja("2026-09-04", "madrugada");
        const dia = new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Bogota",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(d);
        expect(dia).toBe("2026-09-04");
    });

    it("«noche» NO se convierte en madrugada del día siguiente (el error de I-247 b)", () => {
        const d = instanteDeFranja("2026-09-04", "noche");
        expect(horaBogota(d)).toBeGreaterThanOrEqual(18);
        expect(horaBogota(d)).toBeLessThan(24);
    });

    it("esFranja rechaza cualquier cosa que no sea una franja", () => {
        expect(esFranja("noche")).toBe(true);
        expect(esFranja("medianoche")).toBe(false);
        expect(esFranja("")).toBe(false);
    });
});
