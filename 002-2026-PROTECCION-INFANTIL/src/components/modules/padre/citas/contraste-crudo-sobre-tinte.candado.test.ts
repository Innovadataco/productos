/**
 * CANDADO · SPEC-879 (barrido de contraste · followup de 876) · token CRUDO como TEXTO sobre teñido.
 *
 * El barrido de 876 cerró `.text-accent` (candado A, render) y `text-subtle` en `className=` (candado B).
 * Pero la MISMA familia sobrevivía donde el color accent se usa como utilidad de TEXTO directa:
 * `text-cielo`/`text-ambar` crudos (y `text-subtle` sobre teñido), que el candado A —que solo mira
 * `.text-accent`— no veía. Medido por Diseño (claro, AA 4.5): cielo 2.19 · ambar 3.29 · subtle 4.39 (todos
 * FALLAN); pino 4.74 PASA, por eso `text-pino` NO se prohíbe. Fix: variantes legibles `text-estado-cielo`/
 * `text-estado-ambar` (ink/700) y `text-muted`; el RELLENO (`bg-<X>/N`, `border-<X>`, `ring-<X>`) queda crudo
 * —el defecto es el color como TEXTO, no el fondo—.
 *
 * El defecto aparece en DOS formas: (1) misma-clase `bg-X/N … text-X`; (2) padre teñido + hijo con el texto
 * crudo (`<section bg-cielo/10><p text-cielo>`). Un escaneo de cadena por-className ve la forma 1 y es CIEGO
 * a la 2. Por eso, para los accents (`text-cielo`/`text-ambar`), el candado es un BAN DE ARCHIVO: en estas
 * superficies no hay uso legítimo del accent crudo como texto (siempre falla AA), así que se prohíbe en
 * cualquier className, independiente del padre → muere con el defecto en AMBAS formas. Para `text-subtle`
 * (legítimo sobre papel, solo falla sobre tinte) se mantiene la regla same-string+tinte del candado B.
 *
 * ALCANCE (acordado con el CEO, SPEC-879): las 2 superficies RADICADAS/medidas por Diseño. El barrido
 * codebase-wide del mismo patrón (~56, con falsos positivos ícono/texto-grande) se radica APARTE con triaje
 * de Diseño; NO entra aquí.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const VIGILADOS = [
    "src/components/modules/padre/citas/EsperaCitaPanel.tsx",
    "src/components/modules/padre/profesionales/ProfesionalTarjeta.tsx",
];

// Accent crudo como TEXTO: `text-cielo`/`text-ambar` (NO la variante legible `text-estado-*`, NO un relleno
// `bg-/border-/ring-`). Permite el prefijo de variante (`dark:`/`hover:`…): el accent crudo también falla ahí.
const ACCENT_CRUDO = /(?<![\w-])text-(?:cielo|ambar)(?![\w-])/g;
// Relleno teñido en la MISMA className (base, no `hover:`/`dark:`) para la regla de `text-subtle`.
const TINTE = /(?<![:\w-])bg-(?:tinta|cielo|ambar|pino|rubi|acento)\/\d/;
const SUBTLE = /(?<![:\w-])text-subtle\b/;

/** class-lists del archivo: `"…"` y `` `…` `` (p. ej. `TONO_CLASES`); se limpian los `${…}`. */
function classLists(src: string): string[] {
    const out: string[] = [];
    for (const m of src.matchAll(/"([^"\n]*)"|`([^`]*)`/g)) {
        const s = (m[1] ?? m[2] ?? "").replace(/\$\{[^}]*\}/g, " ");
        if (/\b(?:bg|text|border|ring)-/.test(s)) out.push(s);
    }
    return out;
}

function leer(rel: string): string {
    return readFileSync(resolve(__dirname, "../../../../..", rel), "utf-8");
}

describe("SPEC-879 · token crudo como texto sobre teñido (superficies radicadas)", () => {
    it("control positivo: el detector marca lo crudo y respeta lo legible", () => {
        // Marca el accent crudo, con y sin prefijo de variante.
        expect("foo text-cielo bar".match(ACCENT_CRUDO)).not.toBeNull();
        expect("foo dark:text-ambar bar".match(ACCENT_CRUDO)).not.toBeNull();
        // NO marca la variante legible ni los rellenos/bordes.
        expect("text-estado-cielo bg-cielo/10 border-ambar/40 ring-ambar/30".match(ACCENT_CRUDO)).toBeNull();
        // `text-pino` PASA (4.74) → no se prohíbe.
        expect("bg-pino/10 text-pino".match(ACCENT_CRUDO)).toBeNull();
        // subtle: prohibido sobre tinte (misma clase), permitido sobre papel.
        expect(TINTE.test("bg-cielo/10 text-subtle") && SUBTLE.test("bg-cielo/10 text-subtle")).toBe(true);
        expect(TINTE.test("glass text-subtle")).toBe(false);
    });

    it("sin accent crudo (text-cielo/text-ambar) como texto en las superficies vigiladas", () => {
        const viol: string[] = [];
        for (const rel of VIGILADOS) {
            for (const cls of classLists(leer(rel))) {
                const hits = cls.match(ACCENT_CRUDO);
                if (hits) viol.push(`${rel}: «${cls.trim().replace(/\s+/g, " ").slice(0, 80)}» → ${hits.join(",")}`);
            }
        }
        expect(
            viol,
            `accent crudo como texto (usar text-estado-cielo/text-estado-ambar):\n  ${viol.join("\n  ")}`,
        ).toEqual([]);
    });

    it("sin text-subtle sobre relleno teñido (misma clase) en las superficies vigiladas", () => {
        const viol: string[] = [];
        for (const rel of VIGILADOS) {
            for (const cls of classLists(leer(rel))) {
                if (TINTE.test(cls) && SUBTLE.test(cls)) {
                    viol.push(`${rel}: «${cls.trim().replace(/\s+/g, " ").slice(0, 80)}»`);
                }
            }
        }
        expect(viol, `text-subtle sobre teñido (<4.5) — usar text-muted:\n  ${viol.join("\n  ")}`).toEqual([]);
    });
});
