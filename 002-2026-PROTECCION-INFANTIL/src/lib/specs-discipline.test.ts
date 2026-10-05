import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Disciplina de specs (spec 087 · reconciliada por SPEC-865 con el modelo RATIFICADO
 * en SPEC-860: `specs/NNN/` es un HOME OPCIONAL de notas, sin ceremonia Spec-Kit).
 *
 * YA NO se exige el ceremonial: Status, `plan.md`, `tasks.md` ni «Impacto en
 * arquitectura:». Una carpeta de notas puede traer solo `spec.md` (o lo que ayude).
 * Lo que queda es HIGIENE/FORMA, que solo valida SI la carpeta existe y nunca exige
 * artefactos:
 *   - Si una spec DECLARA Status, debe ser del catálogo canónico (forma, no obligación).
 *   - Si una spec se declara CERRADA, debe tener su cierre (consistencia opt-in).
 *   - Números de carpeta no duplicados.
 *   - Representabilidad (SPEC-487): ninguna carpeta `specs/NNN` a medio crear (sin spec.md).
 *
 * Corre en el gate (`npm run test`, job `test-unit`): un PR de CÓDIGO la ejerce
 * siempre, así que ya NO hace falta quitar las notas opcionales de `specs/` en cada
 * PR (el workaround de SPEC-861/866). Con el ceremonial retirado, una nota opcional
 * ya no la rompe.
 *
 * PENDIENTE (SPEC-865 Part 2, companion): que corra TAMBIÉN en PRs docs-only — hoy
 * `should-skip-pi.mjs` salta los cambios bajo `specs/`, así que una violación de la
 * HIGIENE residual (número duplicado, carpeta a medio crear) quedaría latente hasta
 * el primer PR de código. El cambio a `should-skip-pi.mjs` quedó bloqueado por el
 * guard de CI de la sesión; se aplica cuando el permiso lo habilite.
 */

const SPECS_DIR = path.resolve(__dirname, "../../specs");
const STATUS_CANONICOS = new Set([
    "PLANEADO",
    "DESARROLLO",
    "IMPLEMENTADO",
    "PENDIENTE DE PRUEBA",
    "FINALIZADO",
    "CERRADA",
]);

function carpetasSpecs(): string[] {
    return fs
        .readdirSync(SPECS_DIR, { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort();
}

function statusDe(specPath: string): string | null {
    const contenido = fs.readFileSync(specPath, "utf-8");
    const m = contenido.match(/(?:Status|Estado)\**[:：]\s*\*?\*?`?([A-ZÁÉÍÓÚa-z][A-ZÁÉÍÓÚa-z ]*?)(?:`|\*|$|\(|\||\.)/m);
    return m ? m[1].trim() : null;
}

const carpetas = carpetasSpecs().filter((d) => fs.existsSync(path.join(SPECS_DIR, d, "spec.md")));

describe("disciplina de specs (spec 087 · sin ceremonia, SPEC-865)", () => {
    // FORMA (no obligación): una nota puede no declarar Status; pero si lo declara,
    // debe ser del catálogo canónico (un Status inventado sí es un error de forma).
    it("si una spec DECLARA Status, es del catálogo canónico (no se exige declararlo)", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const status = statusDe(path.join(SPECS_DIR, carpeta, "spec.md"));
            if (status !== null && !STATUS_CANONICOS.has(status)) {
                violaciones.push(`${carpeta}: "${status}"`);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("specs CERRADA tienen cierre (carpeta o docs/) — consistencia opt-in", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const num = parseInt(carpeta.split("-")[0], 10);
            if (Number.isNaN(num)) continue;
            const status = statusDe(path.join(SPECS_DIR, carpeta, "spec.md"));
            if (status !== "CERRADA") continue;
            const archivos = fs.readdirSync(path.join(SPECS_DIR, carpeta));
            const tieneCierrePropio = archivos.some((f) => /cierre/i.test(f));
            const cierreEnDocs = fs.existsSync(path.resolve(SPECS_DIR, "../docs", `cierre-${carpeta.split("-")[0]}.md`));
            if (!tieneCierrePropio && !cierreEnDocs) {
                violaciones.push(carpeta);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("no hay números de carpeta duplicados", () => {
        const numeros = new Map<string, string[]>();
        for (const carpeta of carpetas) {
            const num = carpeta.split("-")[0];
            numeros.set(num, [...(numeros.get(num) ?? []), carpeta]);
        }
        const duplicados = [...numeros.entries()].filter(([, v]) => v.length > 1);
        expect(duplicados.map(([n, v]) => `${n}: ${v.join(" vs ")}`)).toEqual([]);
    });

    // SPEC-487 (D-109): el índice specs/README.md ya NO se compara con las carpetas
    // en el PR —eso obligaba a cada PR a editar el índice (clase de conflicto union)—;
    // lo regenera el barrido post-merge. Acá se vigila la REPRESENTABILIDAD de la
    // fuente: ninguna carpeta de spec a medio crear (sin spec.md).
    it("ninguna carpeta specs/NNN queda a medio crear (sin spec.md) — representabilidad (SPEC-487)", () => {
        const sinSpec = carpetasSpecs().filter((c) => !fs.existsSync(path.join(SPECS_DIR, c, "spec.md")));
        expect(sinSpec, sinSpec.join("; ")).toEqual([]);
    });
});
