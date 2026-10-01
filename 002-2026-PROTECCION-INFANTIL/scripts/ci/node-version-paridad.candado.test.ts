/**
 * CANDADO · SPEC-800 — la versión de Node fijada en el repo COINCIDE con la del CI.
 *
 * El defecto (hallazgo de Dev-3): el CI corre Node 22 (los workflows lo fijan) y el repo NO tenía
 * `.nvmrc` ni `engines` — nada pinaba lo local. Un Dev en Node 26 veía un rojo que en CI no existía
 * (y, peor, podría ver un verde que en CI sí falla). Un verde local dejó de predecir el verde del CI.
 *
 * Este candado lee las DOS fuentes y afirma que coinciden:
 *  · el pin local: `.nvmrc` (raíz del repo) y `engines.node` (package.json de 002);
 *  · el CI: TODOS los `node-version:` de TODOS los workflows, por BARRIDO del directorio (no una
 *    lista a mano) — si mañana se agrega un workflow con otra versión, el barrido lo caza.
 *
 * Compara por MAJOR: el CI fija `node-version: 22` (solo el mayor), así que la paridad que importa es
 * la del mayor (fue 22 vs 26 lo que rompió). Control positivo por MUTACIÓN en memoria, en las DOS
 * direcciones (cambiar el pin → rojo · cambiar el workflow → rojo).
 *
 * NO toca el valor del CI: el CI es la referencia y lo local se alinea a él (si el CI debe subir, es
 * otra decisión, del CEO). Unit puro (lee archivos de texto, sin BD) — corre en el carril `test:unit`
 * (registrado en vitest.unit.includes.ts), que `pi-gate` exige: así CORRE en CI y BLOQUEA.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const REPO_ROOT = resolve(AQUI, "../../.."); // raíz del monorepo
const WORKFLOWS_DIR = resolve(REPO_ROOT, ".github/workflows");
const NVMRC = resolve(REPO_ROOT, ".nvmrc");
const PKG_002 = resolve(AQUI, "../../package.json");

/** El MAJOR de una versión en cualquier forma habitual: "22", "22.x", "v22.11.0", ">=22 <23". */
export function majorDeVersion(raw: string): number | null {
    const m = raw.match(/\d+/);
    return m ? Number(m[0]) : null;
}

/** Todos los `node-version:` de un workflow (ignora comentarios), como MAJOR. No matchea `node-version-file:`. */
export function versionesNodeDeWorkflow(texto: string): number[] {
    const out: number[] = [];
    for (const linea of texto.split("\n")) {
        if (/^\s*#/.test(linea)) continue; // comentario: no es un pin vivo
        const m = linea.match(/node-version:\s*['"]?v?(\d+(?:\.\d+)*)/);
        if (m) {
            const mj = majorDeVersion(m[1]!);
            if (mj !== null) out.push(mj);
        }
    }
    return out;
}

/** Los majors que NO coinciden con el fijado. Vacío = paridad. */
export function divergentesDe(pinned: number, majors: number[]): number[] {
    return majors.filter((m) => m !== pinned);
}

describe("SPEC-800 · paridad de la versión de Node (local ↔ CI)", () => {
    const nvmrcMajor = majorDeVersion(readFileSync(NVMRC, "utf8").trim());
    const enginesRaw = (JSON.parse(readFileSync(PKG_002, "utf8")).engines?.node ?? "") as string;
    const enginesMajor = majorDeVersion(enginesRaw);
    const archivos = readdirSync(WORKFLOWS_DIR).filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    const porArchivo = archivos.map((f) => ({ f, majors: versionesNodeDeWorkflow(readFileSync(join(WORKFLOWS_DIR, f), "utf8")) }));
    const conPin = porArchivo.filter((x) => x.majors.length > 0);

    it(".nvmrc y engines.node existen y coinciden entre sí", () => {
        expect(nvmrcMajor, ".nvmrc sin versión legible").not.toBeNull();
        expect(enginesMajor, "engines.node sin versión legible").not.toBeNull();
        expect(enginesMajor).toBe(nvmrcMajor);
    });

    it("el BARRIDO encuentra pines de Node en los workflows (no es una lista vacía)", () => {
        expect(conPin.length, "ningún workflow con node-version — ¿regex o ruta mal?").toBeGreaterThan(0);
    });

    it("TODO node-version de TODOS los workflows coincide con el pin local (barrido real, no lista a mano)", () => {
        const divergentes = porArchivo
            .filter((x) => divergentesDe(nvmrcMajor!, x.majors).length > 0)
            .map((x) => `${x.f}: [${x.majors.join(",")}]`);
        expect(divergentes, `workflows con Node != ${nvmrcMajor}: ${divergentes.join(" · ")}`).toEqual([]);
    });

    it("CONTROL POSITIVO por MUTACIÓN (en memoria, las dos direcciones)", () => {
        // paridad: mismo major en los dos lados → sin divergentes
        expect(divergentesDe(22, versionesNodeDeWorkflow("  node-version: 22\n  node-version: 22\n"))).toEqual([]);
        // cambiar el WORKFLOW (24) con pin 22 → divergente
        expect(divergentesDe(22, versionesNodeDeWorkflow("  node-version: 24\n"))).toEqual([24]);
        // cambiar el PIN (24) con workflow 22 → divergente
        expect(divergentesDe(24, versionesNodeDeWorkflow("  node-version: 22\n"))).toEqual([22]);
        // ignora comentarios; no confunde node-version-file; normaliza v/comillas/patch a MAJOR
        expect(versionesNodeDeWorkflow("  # node-version: 99\n  node-version: 22\n")).toEqual([22]);
        expect(versionesNodeDeWorkflow("  node-version-file: .nvmrc\n")).toEqual([]);
        expect(versionesNodeDeWorkflow("  node-version: 'v22.11.0'\n")).toEqual([22]);
    });
});
