/**
 * CANDADO · SPEC-921 — el step `build` de CI fija un heap suficiente para `next build`.
 *
 * El defecto (I-???): el runner de CI (Node 22.23.4) hacía `FATAL ERROR: ... JavaScript heap out
 * of memory` en `next build` (tope por defecto ~2079 MB) y BLOQUEABA todo merge — determinista,
 * idéntico en #916 y #917; deriva del ENTORNO de CI, no del código de los PRs. El fix fija
 * `NODE_OPTIONS=--max-old-space-size=4096` en el `env:` del step build (mismo tope que el stage
 * builder del Dockerfile, SPEC-856).
 *
 * Este candado lee `.github/workflows/ci.yml`, aísla el BLOQUE del step `- run: npm run build`
 * (su `run` + su `env:`, hasta el siguiente item de la lista) y exige que ahí viva
 * `--max-old-space-size=N` con N ≥ 4096. Muere con el defecto por MUTACIÓN: quitar la línea del
 * env → no hay match → rojo; bajarla a 2048 → `< 4096` → rojo. Unit puro (lee texto, sin BD) — en
 * `vitest.unit.includes.ts`, carril `test:unit` que `pi-gate` exige (CORRE en CI y BLOQUEA).
 *
 * No parsea YAML (mismo estilo de línea que `node-version-paridad`): el barrido es sobre el texto.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const REPO_ROOT = resolve(AQUI, "../../.."); // raíz del monorepo
const CI_YML = resolve(REPO_ROOT, ".github/workflows/ci.yml");

const HEAP_MINIMO_MB = 4096;

/** El bloque del step `- run: npm run build`: su línea + todo lo anidado (su `env:`), hasta el siguiente item. */
export function bloqueStepBuild(texto: string): string | null {
    const lineas = texto.split("\n");
    const idx = lineas.findIndex((l) => /^\s*-\s*run:\s*npm run build\s*$/.test(l));
    if (idx === -1) return null;
    const indentGuion = (lineas[idx]!.match(/^(\s*)-/)?.[1] ?? "").length;
    const bloque = [lineas[idx]!];
    for (let i = idx + 1; i < lineas.length; i++) {
        const l = lineas[i]!;
        if (l.trim() === "") {
            bloque.push(l);
            continue;
        }
        const indent = (l.match(/^(\s*)/)?.[1] ?? "").length;
        // Un item de lista al mismo nivel (o menos), o cualquier dedent ≤ el del guión → terminó el step.
        if (indent <= indentGuion) break;
        bloque.push(l);
    }
    return bloque.join("\n");
}

/** El N de `--max-old-space-size=N` dentro de un `NODE_OPTIONS` del bloque, o null si no está. */
export function heapDelStepBuild(bloque: string): number | null {
    const m = bloque.match(/NODE_OPTIONS:[^\n]*--max-old-space-size=(\d+)/);
    return m ? Number(m[1]) : null;
}

describe("SPEC-921 · el step build de CI fija el heap (anti-OOM)", () => {
    const ci = readFileSync(CI_YML, "utf8");

    it("existe el step `- run: npm run build` en ci.yml", () => {
        expect(bloqueStepBuild(ci), "no encontré el step build en ci.yml").not.toBeNull();
    });

    it(`el step build fija NODE_OPTIONS=--max-old-space-size ≥ ${HEAP_MINIMO_MB}`, () => {
        const bloque = bloqueStepBuild(ci);
        expect(bloque).not.toBeNull();
        const heap = heapDelStepBuild(bloque!);
        expect(heap, "el step build NO fija NODE_OPTIONS=--max-old-space-size (OOM en `next build`)").not.toBeNull();
        expect(heap!).toBeGreaterThanOrEqual(HEAP_MINIMO_MB);
    });
});
