/**
 * CANDADO · SPEC-967 — override acotado `exceljs.uuid`.
 *
 * exceljs 4.4.0 (la última) depende de `uuid ^8.3.0`, que resuelve a 8.3.2 — con una advisory moderada
 * (missing buffer bounds check en v3/v5/v6 con `buf`). El «fix» de npm baja exceljs a 3.4.0 (breaking):
 * NO. En su lugar, `package.json` lleva un override ACOTADO `{ "exceljs": { "uuid": "^11.1.1" } }`.
 *
 * CONDICIÓN DE SALIDA (este candado muere con el defecto AL REVÉS): cuando exceljs DECLARE uuid ≥ 11.1.1,
 * el override sobra y este candado se pone ROJO para que se quite (override + candado + nota de AGENTS).
 *
 * Lee el RANGO que DECLARA exceljs (`node_modules/exceljs/package.json` → `dependencies.uuid`), NUNCA el
 * lock: con el override activo el lock muestra SIEMPRE el valor forzado (11.1.1), así que leerlo no diría
 * nada sobre lo que exceljs pide por sí mismo. Mutación: si exceljs declarara «^11.1.1» → rojo; «^8.3.0» → verde.
 *
 * Sin dependencia de `semver` (no está en el árbol con tipos): el rango que npm pone en `dependencies`
 * es un caret/tilde/exacto, así que la versión mínima es el primer triple `x.y.z` del rango.
 */
import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";

const requerir = createRequire(import.meta.url);
const UMBRAL_SEGURO: [number, number, number] = [11, 1, 1];

/** Versión mínima (primer `x.y.z`) de un rango de dependencia npm; null si no hay triple. */
function versionMinima(rango: string): [number, number, number] | null {
    const m = rango.match(/(\d+)\.(\d+)\.(\d+)/);
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

/** a < b comparando major, minor, patch. */
function menor(a: [number, number, number], b: [number, number, number]): boolean {
    for (let i = 0; i < 3; i += 1) {
        if (a[i]! !== b[i]!) return a[i]! < b[i]!;
    }
    return false;
}

describe("SPEC-967 · override exceljs.uuid vigente", () => {
    it("exceljs aún DECLARA uuid por debajo de 11.1.1 → el override sigue justificado", () => {
        const rango: string = requerir("exceljs/package.json").dependencies.uuid;
        const min = versionMinima(rango);
        expect(min, `exceljs no declara un rango de uuid parseable: ${rango}`).not.toBeNull();
        expect(
            menor(min!, UMBRAL_SEGURO),
            `exceljs ya declara uuid ≥ ${UMBRAL_SEGURO.join(".")} (rango ${rango}): quita el override de package.json, este candado y la nota de AGENTS.md (Dependencias)`
        ).toBe(true);
    });
});
