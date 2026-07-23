import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Disciplina Spec-Kit (spec 087-US5): corre en el gate (`npm run test`).
 * Falla si: Status fuera del catálogo canónico, spec CERRADA (>021) sin cierre,
 * número de carpeta duplicado, o índice specs/README.md inconsistente con las carpetas.
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

describe("disciplina Spec-Kit (spec 087)", () => {
    it("toda spec declara Status del catálogo canónico", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const status = statusDe(path.join(SPECS_DIR, carpeta, "spec.md"));
            if (!status || !STATUS_CANONICOS.has(status)) {
                violaciones.push(`${carpeta}: "${status ?? "sin Status"}"`);
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });

    it("specs >021 CERRADA tienen cierre (carpeta o docs/)", () => {
        const violaciones: string[] = [];
        for (const carpeta of carpetas) {
            const num = parseInt(carpeta.split("-")[0], 10);
            if (Number.isNaN(num) || num <= 21) continue;
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

    it("el índice specs/README.md cubre todas las carpetas reales", () => {
        const readme = fs.readFileSync(path.join(SPECS_DIR, "README.md"), "utf-8");
        const faltantes = carpetas.filter((c) => !readme.includes(`(${c}/spec.md)`));
        expect(faltantes, faltantes.join("; ")).toEqual([]);
    });
});
