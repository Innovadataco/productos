/**
 * CANDADO · SPEC-976 — los documentos RAÍZ del monorepo (`AGENTS.md` y `README.md`) describen
 * la estructura REAL. Los leen TODAS las sesiones de TODOS los productos.
 *
 * El defecto: ambos citaban carpetas que no existen (`fabrica-de-software/`,
 * `documentacion-tecnica/`), reglas derogadas («5 reglas de oro», «sin ACTA-VALIDACION no hay
 * merge») y describían mal el repo. Una sesión que los tomaba como verdad arrancaba perdida.
 *
 * Por CADA documento raíz este candado afirma, contra el disco, que lo que nombra es real:
 *  1. NO cita las carpetas derogadas (imposibilidad estructural: si vuelven al texto, rojo).
 *  2. Toda carpeta de producto `NNN-AAAA-<NOMBRE>` que menciona EXISTE como directorio en la raíz.
 *  3. Todo workflow `*.yml` que menciona EXISTE en `.github/workflows/`.
 * Además, el parser no quedó vacío (AGENTS.md cita ≥2 productos y ≥2 workflows; README ≥2
 * productos): evita un verde vacuo si una regex deja de casar.
 *
 * Control positivo por MUTACIÓN en memoria: re-citar una carpeta muerta → rojo; citar un
 * producto o un workflow inexistente → rojo. NO afirma sobre prosa: solo sobre tokens que el
 * disco puede confirmar. Unit puro (lee archivos de texto, sin BD) — corre en el carril
 * `test:unit` (registrado en vitest.unit.includes.ts), que `pi-gate` exige: CORRE en CI y BLOQUEA.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // 002-…/scripts/ci
const REPO_ROOT = resolve(AQUI, "../../.."); // raíz del monorepo
const WORKFLOWS_DIR = resolve(REPO_ROOT, ".github/workflows");

/** Documentos raíz que leen todas las sesiones. */
const DOCS_RAIZ = ["AGENTS.md", "README.md"] as const;

/** Carpetas que el texto anterior inventaba y que NO existen en el repo. */
export const CARPETAS_DEROGADAS = ["fabrica-de-software", "documentacion-tecnica"] as const;

/** Las derogadas que aún aparezcan en el texto. Vacío = ninguna. */
export function carpetasDerogadasEnTexto(texto: string): string[] {
    return CARPETAS_DEROGADAS.filter((c) => texto.includes(c));
}

/** Tokens de carpeta de producto `NNN-AAAA-<NOMBRE>` citados (NOMBRE en mayúsculas y guiones). */
export function carpetasDeProductoReferenciadas(texto: string): string[] {
    const encontrados = texto.match(/\d{3}-\d{4}-[A-ZÑ][A-ZÑ-]*/g) ?? [];
    return [...new Set(encontrados)];
}

/** Nombres de archivo de workflow `*.yml`/`*.yaml` citados (basename). */
export function workflowsReferenciados(texto: string): string[] {
    const encontrados = texto.match(/[A-Za-z0-9][A-Za-z0-9._-]*\.ya?ml/g) ?? [];
    return [...new Set(encontrados)];
}

describe("SPEC-976 · los documentos raíz describen la estructura real", () => {
    for (const doc of DOCS_RAIZ) {
        describe(doc, () => {
            const ruta = resolve(REPO_ROOT, doc);
            it("existe", () => {
                expect(existsSync(ruta), `no existe ${ruta}`).toBe(true);
            });

            const texto = existsSync(ruta) ? readFileSync(ruta, "utf8") : "";

            it("NO cita carpetas derogadas (imposibilidad estructural)", () => {
                expect(carpetasDerogadasEnTexto(texto), "carpetas muertas aún citadas").toEqual([]);
            });

            it("toda carpeta de producto citada EXISTE como directorio en la raíz", () => {
                const fantasmas = carpetasDeProductoReferenciadas(texto).filter((p) => {
                    const r = resolve(REPO_ROOT, p);
                    return !existsSync(r) || !statSync(r).isDirectory();
                });
                expect(fantasmas, `carpetas citadas que no existen: ${fantasmas.join(" · ")}`).toEqual([]);
            });

            it("todo workflow citado EXISTE en .github/workflows/", () => {
                const fantasmas = workflowsReferenciados(texto).filter((w) => !existsSync(resolve(WORKFLOWS_DIR, w)));
                expect(fantasmas, `workflows citados que no existen: ${fantasmas.join(" · ")}`).toEqual([]);
            });

            it("el parser no quedó vacío (cita ≥2 productos)", () => {
                expect(carpetasDeProductoReferenciadas(texto).length, "ningún NNN-AAAA-* — ¿regex o ruta mal?").toBeGreaterThanOrEqual(2);
            });
        });
    }

    it("AGENTS.md cita ≥2 workflows del ruleset (no es un verde vacuo)", () => {
        const texto = readFileSync(resolve(REPO_ROOT, "AGENTS.md"), "utf8");
        expect(workflowsReferenciados(texto).length, "ningún *.yml citado — ¿regex o ruta mal?").toBeGreaterThanOrEqual(2);
    });

    it("CONTROL POSITIVO por MUTACIÓN (en memoria, las dos direcciones)", () => {
        // re-citar una carpeta muerta → la detecta
        expect(carpetasDerogadasEnTexto("vive en fabrica-de-software/x")).toEqual(["fabrica-de-software"]);
        expect(carpetasDerogadasEnTexto("002-2026-PROTECCION-INFANTIL/ y nada más")).toEqual([]);
        // citar un producto inexistente → lo lista junto a los reales
        expect(carpetasDeProductoReferenciadas("002-2026-PROTECCION-INFANTIL y 099-2026-FALSO")).toEqual([
            "002-2026-PROTECCION-INFANTIL",
            "099-2026-FALSO",
        ]);
        // workflows: toma el basename aunque venga con ruta; .ts no cuenta
        expect(workflowsReferenciados("ver `.github/workflows/ci.yml` e inv-frontera.yml")).toEqual([
            "ci.yml",
            "inv-frontera.yml",
        ]);
        expect(workflowsReferenciados("agents-raiz.candado.test.ts")).toEqual([]);
    });
});
