/**
 * SPEC-486 (infra · Node 24 / git 2.55.0 en el runner de CI): los `rmSync` de
 * limpieza que borran dirs temporales con git (o cualquier árbol) tiran
 * `ENOTEMPTY`/`EBUSY` en el runner nuevo si no llevan `maxRetries` — el archivo
 * de test se marca "failed" en su `afterAll` aunque TODOS los tests pasen
 * (caso #403/SPEC-432). Este candado exige que TODO `rmSync(recursive)` de
 * cleanup lleve `maxRetries`, matando la clase.
 *
 * Contraprueba (mutación): sacar `maxRetries` de cualquier `rmSync(recursive)` → rojo.
 * NO cambia ninguna aserción de los candados que barre; solo su robustez de limpieza.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const RAIZ = resolve(__dirname, "..", "..");
const RAICES = [join(RAIZ, "scripts"), join(RAIZ, "src")];

function incluido(ruta: string): boolean {
    // scripts/**: todos los .ts/.tsx; src/**: solo tests (donde viven los rmSync de cleanup).
    if (/\/scripts\//.test(ruta)) return /\.tsx?$/.test(ruta);
    return /\.test\.tsx?$/.test(ruta);
}

function* recorrer(dir: string): Generator<string> {
    let entradas;
    try {
        entradas = readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entradas) {
        if (e.name === "node_modules" || e.name === ".next" || e.name === "dist") continue;
        const ruta = join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(ruta);
        else yield ruta;
    }
}

describe("SPEC-486 · todo rmSync(recursive) de cleanup lleva maxRetries (Node 24)", () => {
    it("cero rmSync(recursive) sin maxRetries en scripts/ y en los tests de src/", () => {
        const ofensores: string[] = [];
        for (const raiz of RAICES) {
            for (const ruta of recorrer(raiz)) {
                if (!incluido(ruta)) continue;
                if (ruta.endsWith("rmsync-maxretries.candado.test.ts")) continue; // no escanear este candado
                for (const linea of readFileSync(ruta, "utf-8").split("\n")) {
                    if (/rmSync\(/.test(linea) && /recursive/.test(linea) && !/maxRetries/.test(linea)) {
                        ofensores.push(`${ruta.split("/002-2026-PROTECCION-INFANTIL/")[1] ?? ruta}: ${linea.trim()}`);
                    }
                }
            }
        }
        expect(ofensores, `rmSync(recursive) sin maxRetries (ENOTEMPTY en Node 24/git 2.55):\n${ofensores.join("\n")}`).toEqual([]);
    });
});
