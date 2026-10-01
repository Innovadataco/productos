/**
 * CANDADO · SPEC-825 (exigencia del CEO) · la ELEGIBILIDAD REPS se computa en UN SOLO lugar.
 *
 * Al extraer `idsRepsElegibles` a `elegibilidad-reps-lote.ts`, el riesgo no es mover el código: es que
 * aparezca una SEGUNDA fuente el día que alguien no encuentre la primera. Por eso el candado fija el contrato:
 * el predicado `repsElegible` (la pieza que DECIDE elegibilidad por fila) se LLAMA únicamente en el módulo de
 * lote. `perfil-profesional.idsRepsElegibles` DELEGA (no lo llama); `franja-disponible` usa el módulo. Si
 * `repsElegible(` aparece en cualquier otro archivo de producción, hay una elegibilidad reimplementada → ROJO.
 *
 * (El DISPLAY del aviso —clasificarAvisoReps/zonaAdminReps— es otra cosa: clasifica el estado para el
 * profesional/admin, no computa el set ofrecible; por eso no llama `repsElegible`.)
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const SRC = path.resolve(__dirname, "../../..");

/** Archivos de PRODUCCIÓN (no tests) donde se PERMITE `repsElegible(`. */
const PERMITIDOS = new Set<string>([
    "lib/profesional/reps/reps-elegibilidad.ts", // DEFINE repsElegible
    "lib/profesional/reps/elegibilidad-reps-lote.ts", // ÚNICO que lo LLAMA (fuente del set elegible)
]);

function tsDeProduccion(dir: string, acc: string[] = []): string[] {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
        const abs = path.join(dir, ent.name);
        if (ent.isDirectory()) {
            if (ent.name === "node_modules" || ent.name === ".next") continue;
            tsDeProduccion(abs, acc);
        } else if (/\.tsx?$/.test(ent.name) && !/\.test\.tsx?$/.test(ent.name)) {
            acc.push(abs);
        }
    }
    return acc;
}

describe("SPEC-825 · elegibilidad REPS: una sola fuente", () => {
    it("`repsElegible(` se llama SOLO en el módulo de lote (nadie más reimplementa la elegibilidad)", () => {
        const culpables: string[] = [];
        for (const abs of tsDeProduccion(SRC)) {
            if (readFileSync(abs, "utf8").includes("repsElegible(")) {
                const rel = path.relative(SRC, abs);
                if (!PERMITIDOS.has(rel)) culpables.push(rel);
            }
        }
        expect(
            culpables,
            `estos archivos llaman repsElegible( fuera del módulo de lote (segunda fuente de elegibilidad): ${culpables.join(", ")}`,
        ).toEqual([]);
    });
});
