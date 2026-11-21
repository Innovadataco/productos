/**
 * CANDADO · SPEC-976 — el AGENTS.md RAÍZ del monorepo describe la estructura REAL.
 *
 * El defecto: el `/AGENTS.md` raíz (lo leen TODAS las sesiones de TODOS los productos) citaba
 * carpetas que no existen (`fabrica-de-software/`, `documentacion-tecnica/`), repetía reglas
 * derogadas y describía mal el repo. Una sesión que lo tomaba como verdad arrancaba perdida.
 *
 * Este candado lee el AGENTS.md raíz y afirma, contra el disco, que lo que nombra es real:
 *  1. NO cita las dos carpetas derogadas (imposibilidad estructural: si vuelven al texto, rojo).
 *  2. Toda carpeta de producto `NNN-AAAA-<NOMBRE>` que menciona EXISTE como directorio en la raíz.
 *  3. Todo workflow `*.yml` que menciona EXISTE en `.github/workflows/`.
 *  4. El parser no quedó vacío (cita ≥2 productos y ≥2 workflows): evita un verde vacuo.
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
const AGENTS_RAIZ = resolve(REPO_ROOT, "AGENTS.md");
const WORKFLOWS_DIR = resolve(REPO_ROOT, ".github/workflows");

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

describe("SPEC-976 · el AGENTS.md raíz describe la estructura real", () => {
    const texto = readFileSync(AGENTS_RAIZ, "utf8");
    const productos = carpetasDeProductoReferenciadas(texto);
    const workflows = workflowsReferenciados(texto);

    it("existe el AGENTS.md raíz", () => {
        expect(existsSync(AGENTS_RAIZ), `no existe ${AGENTS_RAIZ}`).toBe(true);
    });

    it("NO cita carpetas derogadas (imposibilidad estructural)", () => {
        expect(carpetasDerogadasEnTexto(texto), "carpetas muertas aún citadas").toEqual([]);
    });

    it("el parser no quedó vacío (cita ≥2 productos y ≥2 workflows)", () => {
        expect(productos.length, "ningún NNN-AAAA-* — ¿regex o ruta mal?").toBeGreaterThanOrEqual(2);
        expect(workflows.length, "ningún *.yml citado — ¿regex o ruta mal?").toBeGreaterThanOrEqual(2);
    });

    it("toda carpeta de producto citada EXISTE como directorio en la raíz", () => {
        const fantasmas = productos.filter((p) => {
            const ruta = resolve(REPO_ROOT, p);
            return !existsSync(ruta) || !statSync(ruta).isDirectory();
        });
        expect(fantasmas, `carpetas citadas que no existen: ${fantasmas.join(" · ")}`).toEqual([]);
    });

    it("todo workflow citado EXISTE en .github/workflows/", () => {
        const fantasmas = workflows.filter((w) => !existsSync(resolve(WORKFLOWS_DIR, w)));
        expect(fantasmas, `workflows citados que no existen: ${fantasmas.join(" · ")}`).toEqual([]);
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
