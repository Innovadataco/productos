/**
 * SPEC-464 · Admin: rojos → `rubi`. La regla dura del territorio interno: **ningún
 * rojo crudo** en las pantallas admin (errores, obligatorios, severidad y estados van
 * en el token `rubi`, criticidad legítima del backoffice). Diseño verificó que ninguno
 * es una alarma sobre un niño (a diferencia del colegio).
 *
 * Barrido de conducta (no de una clase suelta): recorre `src/app/dashboard/admin/**`
 * y falla si aparece cualquier `(bg|text|border|ring|from|to)-red-NNN`.
 * Contraprueba (por mutación): devolver un `text-red-600` a cualquier pantalla admin → rojo.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const RAIZ = resolve(__dirname, "..", "..", "app", "dashboard", "admin");
const CRUDO_ROJO = /\b(?:bg|text|border|ring|from|to|via|divide|ring-offset)-red-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/g;

function* tsx(dir: string): Generator<string> {
    for (const e of readdirSync(dir)) {
        const p = join(dir, e);
        if (statSync(p).isDirectory()) yield* tsx(p);
        else if (/\.tsx?$/.test(e) && !/\.test\.tsx?$/.test(e)) yield p;
    }
}

describe("SPEC-464 · las pantallas admin no pintan rojo crudo", () => {
    it("ningún `red-*` crudo en src/app/dashboard/admin (todo va en `rubi`)", () => {
        const ofensores: string[] = [];
        for (const f of tsx(RAIZ)) {
            const src = readFileSync(f, "utf-8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
            const m = src.match(CRUDO_ROJO);
            if (m) ofensores.push(`${f.split("/dashboard/")[1]}: ${[...new Set(m)].join(", ")}`);
        }
        expect(
            ofensores,
            `Rojo crudo en pantallas admin — va en token \`rubi\` (criticidad del backoffice):\n${ofensores.join("\n")}`,
        ).toEqual([]);
    });
});
