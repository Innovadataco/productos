/**
 * SPEC-438 · la franja aproximada cae donde el reportante dijo — en Bogotá.
 *
 * Es el mismo error que costó I-247 b: calcular la franja sobre UTC hacía que
 * la noche entera llegara al modelo como madrugada. Acá se prueba al revés:
 * que «noche» siga siendo noche cuando el analizador la lea en hora local.
 */
import { describe, it, expect } from "vitest";
import { instanteDeFranja, HORA_REPRESENTATIVA, FRANJAS, esFranja, ETIQUETA_FRANJA } from "./franja-aproximada";

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

/**
 * SPEC-653 (forma · Diseño FORMA-SPEC653-NBSP-FRANJA-HORARIA): dentro de cada
 * hora, el número y su meridiano NO se separan — `6 a.m.`, `12 m.`—. Así,
 * al envolver en la caja del timeline del expediente, el corte cae en el guion
 * `–` (el rango queda a dos líneas con AMBAS horas enteras) y nunca deja un
 * meridiano huérfano («6» arriba / «a.m.» abajo). El no-ruptura va SOLO entre
 * número y meridiano: NO alrededor del `–`, NO el paréntesis entero (eso volvería
 * la etiqueta un token indivisible que desborda `w-24`).
 *
 * CONDUCTA sobre los BYTES de `ETIQUETA_FRANJA`, NO contra un literal copiado
 * (un literal consagra el texto de hoy y no ve el retipeo de mañana). Muere por
 * mutación: cambiar un ` ` por un espacio normal en cualquier etiqueta → rojo.
 */
describe("SPEC-653 · número y meridiano no se parten (nbsp interno en ETIQUETA_FRANJA)", () => {
    // dígito + espacio NORMAL (U+0020) + meridiano = el defecto (se puede partir).
    const NUM_ESPACIO_MERIDIANO = /\d (a\.m\.|p\.m\.|m\.)/;
    // El NO-RUPTURA se CONSTRUYE del code point (0x00A0), nunca invisible en el fuente:
    // un invisible es justo lo que un retipeo borra sin que se vea (el defecto que cerramos).
    const NBSP = String.fromCharCode(0x00a0);
    const NUM_NBSP_MERIDIANO = new RegExp("\\d" + NBSP + "(a\\.m\\.|p\\.m\\.|m\\.)");

    it.each(FRANJAS)("«%s»: ningún número-meridiano separado por espacio normal", (franja) => {
        const etq = ETIQUETA_FRANJA[franja];
        expect(
            NUM_ESPACIO_MERIDIANO.test(etq),
            `${franja}="${etq}": hay un espacio NORMAL entre número y meridiano. Usá \\u00A0 — si la caja envuelve, parte «6» de «a.m.».`,
        ).toBe(false);
        // Positivo: la etiqueta DE VERDAD trae el no-ruptura (que borrar el token no
        // deje la aserción negativa vacía y verde).
        expect(
            NUM_NBSP_MERIDIANO.test(etq),
            `${franja}="${etq}": debería unir número y meridiano con \\u00A0.`,
        ).toBe(true);
    });
});
