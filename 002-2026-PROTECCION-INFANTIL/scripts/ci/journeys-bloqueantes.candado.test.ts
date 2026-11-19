/**
 * CANDADO · SPEC-930 — los journeys de regresión de Calidad BLOQUEAN el merge.
 *
 * El defecto: los `tests/e2e/recorrido-journey-*.spec.ts` corrían SOLO dentro de `test-e2e`, cuyo
 * paso de suite es `continue-on-error` y que no está en gate/pi-gate (SPEC-789) → un journey rojo
 * se veía verde. El fix: job `journeys-e2e` que corre SOLO esos specs, DURO, exigido por pi-gate.
 *
 * Amarra (lee `.github/workflows/ci.yml`, sin parsear YAML — mismo estilo que build-heap-ci):
 *   (1) el job `journeys-e2e` existe, corre en todo PR de PI (solo depende de should-skip, NO del
 *       filtro e2e de should-run-e2e-pi) y filtra por el prefijo `recorrido-journey-`;
 *   (2) es DURO: ni el job ni su paso llevan `continue-on-error`;
 *   (3) `pi-gate` (y `gate`) lo tienen en `needs`;
 *   (5) el verificador de CONTEO (`verificar-journeys.mjs`): 0 journeys / sin reporte / journey rojo / archivo
 *       que no corrió → ROJO; todos ok → VERDE;
 *   (6) Playwright CARGA su config (SPEC-817 la rompió 7 semanas: `import.meta` en CJS). Se ejerce de verdad:
 *       `playwright test --list` sobre los journeys debe salir 0.
 *   (4) control POSITIVO de conducta: con la regla de veredicto REAL de pi-gate (leída del yml:
 *       failure/cancelled en needs → exit 1), un `journeys-e2e` en `failure` deja pi-gate ROJO; y
 *       si se lo saca de `needs`, el mismo fallo pasaría VERDE (el defecto).
 *
 * Unit puro (lee texto) — en `vitest.unit.includes.ts`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { verificarJourneys } from "./verificar-journeys.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CI_YML = resolve(AQUI, "../../../.github/workflows/ci.yml");
const ci = readFileSync(CI_YML, "utf8");

/** Bloque de un job de primer nivel (`  <id>:` hasta el siguiente job de primer nivel). */
export function bloqueJob(texto: string, id: string): string | null {
    const lineas = texto.split("\n");
    const idx = lineas.findIndex((l) => l === `  ${id}:`);
    if (idx === -1) return null;
    const fin = lineas.findIndex((l, i) => i > idx && /^ {2}[A-Za-z0-9_-]+:\s*$/.test(l));
    return lineas.slice(idx, fin === -1 ? undefined : fin).join("\n");
}

/** Los `needs:` de un job (lista en línea `needs: [a, b]`). */
export function needsDe(bloque: string): string[] {
    const m = bloque.match(/^ {4}needs:\s*\[([^\]]*)\]/m);
    return m ? m[1].split(",").map((s) => s.trim()).filter(Boolean) : [];
}

/** Simula el veredicto de pi-gate con SU regla (failure/cancelled en needs → rojo). */
export function veredictoPiGate(needs: string[], resultados: Record<string, string>): "rojo" | "verde" {
    const rs = needs.map((n) => resultados[n] ?? "success");
    return rs.includes("failure") || rs.includes("cancelled") ? "rojo" : "verde";
}

describe("SPEC-930 · los journeys de regresión bloquean el merge", () => {
    const job = bloqueJob(ci, "journeys-e2e");
    const piGate = bloqueJob(ci, "pi-gate");
    const gate = bloqueJob(ci, "gate");

    it("(1) el job journeys-e2e existe, corre en todo PR de PI y filtra por el prefijo", () => {
        expect(job, "no existe el job journeys-e2e en ci.yml").not.toBeNull();
        expect(needsDe(job!)).toEqual(["should-skip"]);
        expect(job!).toMatch(/^ {4}if: needs\.should-skip\.outputs\.skip != 'true'\s*$/m);
        expect(job!).not.toMatch(/outputs\.e2e/); // no hereda el filtro blando de test-e2e
        expect(job!).toMatch(/run: npm run test:e2e -- recorrido-journey- --reporter=list,json/);
        expect(job!).toMatch(/PLAYWRIGHT_JSON_OUTPUT_NAME: journeys-report\.json/);
        expect(job!, "0 journeys NO puede pasar verde").not.toMatch(/--pass-with-no-tests/);
        // El CONTEO se afirma en un paso que corre SIEMPRE (también si Playwright no arrancó).
        expect(job!).toMatch(/if: always\(\)\n\s+run: node scripts\/ci\/verificar-journeys\.mjs journeys-report\.json/);
    });

    it("(2) es DURO: sin continue-on-error", () => {
        expect(job!).not.toMatch(/^\s*continue-on-error:/m);
    });

    it("(3) pi-gate y gate lo exigen en needs", () => {
        expect(needsDe(piGate!)).toContain("journeys-e2e");
        expect(needsDe(gate!)).toContain("journeys-e2e");
    });

    it("(4) control POSITIVO: la regla real de pi-gate + journey en failure → ROJO", () => {
        // La regla que simulamos ES la de pi-gate (si cambia, este candado tiene que revisarse).
        expect(piGate!).toMatch(/contains\(needs\.\*\.result, 'failure'\)/);
        expect(piGate!).toMatch(/contains\(needs\.\*\.result, 'cancelled'\)/);
        const needs = needsDe(piGate!);
        expect(veredictoPiGate(needs, { "journeys-e2e": "failure" })).toBe("rojo");
        expect(veredictoPiGate(needs, { "journeys-e2e": "success" })).toBe("verde");
        // El defecto: sin journeys-e2e en needs, el mismo fallo pasaba verde.
        const sinJourneys = needs.filter((n) => n !== "journeys-e2e");
        expect(veredictoPiGate(sinJourneys, { "journeys-e2e": "failure" })).toBe("verde");
    });

    it("(5) verificador de CONTEO: 0 journeys / sin reporte / rojo / faltante → ROJO; todo ok → VERDE", () => {
        const archivos = ["recorrido-journey-a.spec.ts", "recorrido-journey-b.spec.ts"];
        const reporte = (estados: Record<string, string[]>) => ({
            suites: Object.entries(estados).map(([file, sts]) => ({
                file,
                specs: sts.map((status, i) => ({ title: `t${i}`, file, tests: [{ status }] })),
            })),
        });
        const v = verificarJourneys as (r: unknown, a: string[]) => { ok: boolean; errores: string[] };
        expect(v(reporte({ [archivos[0]]: ["expected"], [archivos[1]]: ["flaky"] }), archivos).ok).toBe(true);
        expect(v(reporte({}), []).ok, "0 journeys en el árbol → rojo").toBe(false);
        expect(v(null, archivos).ok, "sin reporte (config rota) → rojo").toBe(false);
        expect(v(reporte({ [archivos[0]]: ["expected"], [archivos[1]]: ["unexpected"] }), archivos).ok, "journey rojo → rojo").toBe(false);
        expect(v(reporte({ [archivos[0]]: ["expected"] }), archivos).ok, "un journey no corrió → rojo").toBe(false);
        expect(v(reporte({ [archivos[0]]: ["expected"], [archivos[1]]: ["skipped"] }), archivos).ok, "skipped → rojo").toBe(false);
    });

    it("(6) Playwright CARGA su config (sin `import.meta` en CJS) y lista los journeys", () => {
        const raiz = resolve(AQUI, "../..");
        const salida = execFileSync(
            process.execPath,
            ["--env-file=.env.test", "./node_modules/@playwright/test/cli.js", "test", "--list", "recorrido-journey-", "--pass-with-no-tests"],
            {
                cwd: raiz,
                encoding: "utf8",
                timeout: 90_000,
                env: { ...process.env, DATABASE_URL: "postgresql://x:y@localhost:5433/candado_930_test" },
            },
        );
        expect(salida).toMatch(/Total: \d+ tests? in \d+ files?/);
    }, 120_000);
});
