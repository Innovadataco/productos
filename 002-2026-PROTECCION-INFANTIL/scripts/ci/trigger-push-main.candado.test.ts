/**
 * CANDADO · SPEC-774 — la suite de CI corre sobre `main`. Lee el `ci.yml` REAL (no una constante
 * copiada: el defecto fue exactamente una lista que nadie volvió a leer):
 *  · FR-3 (DURA): `on.push.branches` incluye `main`. El trigger apuntaba a `feature/001-scaffolding`,
 *    una rama FANTASMA (no existe) → el push nunca disparaba y nadie lo notó en meses.
 *  · Segunda (D-4): la rama fantasma NO queda en ningún lado del `ci.yml` — ni el trigger (L12) ni el
 *    `if` del paso `test-durations.json` (L378). Ese 2º defecto congeló el sharding por peso en
 *    silencio: el mecanismo corre, su insumo nunca se actualiza. Una cadena muerta, dos defectos.
 *
 * NACE ROJO contra el `ci.yml` de hoy (fantasma, sin `main`). El arreglo del `ci.yml` va DESPUÉS del
 * PR de Calidad que edita ese archivo (coordinación), y con él este candado pasa a VERDE y se
 * REGISTRA en el manifiesto unit — un candado que nace rojo NO se deja bloqueando el CI del equipo.
 * El control positivo por MUTACIÓN vive en fixtures en memoria (no depende del estado del archivo).
 *
 * Unit puro (lee un archivo de texto, sin BD).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const CI_YML = resolve(AQUI, "../../../.github/workflows/ci.yml"); // raíz del monorepo
const RAMA_FANTASMA = "feature/001-scaffolding";

/**
 * Extrae `on.push.branches` del workflow SIN dep de YAML: parseo dirigido por indentación (2 espacios).
 * Localiza `push:` dentro de `on:` y lee su `branches:` en forma inline `[a, b]` o de lista `- a`.
 * No es un regex ciego (que matchearía el `branches:` de `pull_request` u otro bloque).
 */
export function ramasDelPushTrigger(texto: string): string[] {
    const lineas = texto.split("\n");
    const iOn = lineas.findIndex((l) => /^on:\s*$/.test(l));
    if (iOn === -1) return [];
    let enPush = false;
    for (let i = iOn + 1; i < lineas.length; i++) {
        const l = lineas[i]!;
        if (/^\S/.test(l)) break; // salió del bloque `on:` (columna 0)
        if (/^ {2}push:\s*$/.test(l)) { enPush = true; continue; }
        if (enPush && /^ {2}\S/.test(l)) break; // otro hijo de `on:` (pull_request/workflow_dispatch)
        if (!enPush) continue;
        const m = l.match(/^ {4}branches:\s*(.*)$/);
        if (!m) continue;
        const val = m[1]!.trim();
        if (val.startsWith("[")) {
            return val.replace(/^\[|\]$/g, "").split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
        }
        const ramas: string[] = [];
        for (let j = i + 1; j < lineas.length; j++) {
            const mm = lineas[j]!.match(/^ {6}- (.*)$/);
            if (!mm) break;
            ramas.push(mm[1]!.trim().replace(/^['"]|['"]$/g, ""));
        }
        return ramas;
    }
    return [];
}

describe("SPEC-774 · el trigger de push corre la suite sobre `main`", () => {
    const yml = readFileSync(CI_YML, "utf8");

    it("FR-3 (DURA · ci.yml REAL): on.push.branches incluye `main`", () => {
        expect(ramasDelPushTrigger(yml)).toContain("main");
    });

    it("segunda (ci.yml REAL): la rama fantasma no queda en posición FUNCIONAL (trigger ni gate de duraciones)", () => {
        // El defecto son las referencias que ACTÚAN: el trigger y los `if: github.ref == …`. Un
        // comentario que EXPLIQUE por qué la rama estaba muerta (defecto de duraciones, D-2) es
        // deseable, no un defecto — por eso NO se prohíbe el literal en comentarios, solo su uso vivo.
        expect(ramasDelPushTrigger(yml), "la rama fantasma sigue en push.branches").not.toContain(RAMA_FANTASMA);
        const gateVivo = new RegExp(`github\\.ref\\s*==\\s*['"]refs/heads/${RAMA_FANTASMA.replace(/\//g, "/")}['"]`);
        expect(gateVivo.test(yml), `un \`if: github.ref == 'refs/heads/${RAMA_FANTASMA}'\` sigue vivo (p. ej. el paso de duraciones)`).toBe(false);
    });

    it("CONTROL POSITIVO por MUTACIÓN: el parser distingue `main` presente de ausente (inline y bloque)", () => {
        const conMain = "on:\n  push:\n    branches: [main]\n  pull_request:\n";
        const sinMain = "on:\n  push:\n    branches: [feature/001-scaffolding]\n  pull_request:\n";
        const bloque = "on:\n  push:\n    branches:\n      - main\n      - release\n";
        const otroBranches = "on:\n  pull_request:\n    branches: [develop]\n  push:\n    branches: [main]\n";
        expect(ramasDelPushTrigger(conMain)).toContain("main");
        expect(ramasDelPushTrigger(sinMain)).not.toContain("main"); // el defecto de hoy
        expect(ramasDelPushTrigger(bloque)).toEqual(["main", "release"]);
        expect(ramasDelPushTrigger(otroBranches)).toEqual(["main"]); // no confunde con el branches de pull_request
    });
});
