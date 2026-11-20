/**
 * SPEC-960 (auditoría diaria de repos · hallazgo 🔴 B1) — Candado de higiene del repo PÚBLICO.
 *
 * `productos` es un repositorio PÚBLICO. Dos clases de fuga deben quedar IMPOSIBLES
 * de re-introducir en HEAD:
 *
 *  (A) Borradores legales internos bajo `002-.../docs/legal/`. SPEC-343 movió los
 *      originales ahí "para dejar de servirlos por la web", pero el repo es público:
 *      no deben estar versionados en absoluto (viven en el repo PRIVADO de gestión).
 *      Este candado cae si REAPARECE cualquier archivo bajo `docs/legal/`.
 *
 *  (B) El marcador de campo de borrador legal `[ABOGADO:` (el hueco que un abogado
 *      debe llenar) dentro de cualquier `.md` del árbol del producto, SALVO:
 *        · `public/legal/`  → documentos PUBLICADOS por diseño. Su higiene ya la
 *          vigila `documentos-servidos.test.ts` (ahí el marcador tampoco puede estar);
 *          no los re-escaneamos acá para no duplicar la fuente de verdad.
 *        · `specs/**`        → design-docs internos que sólo MENCIONAN el patrón al
 *          documentar el trabajo legal (p.ej. `specs/343` dice «11 campos `[ABOGADO: …]`»).
 *          Son menciones en prosa, no huecos reales; y una spec no es un borrador legal.
 *          (Acotado a propósito: ver nota al CEO en el PR de SPEC-960.)
 *
 * Control positivo (verificado por mutación antes de abrir el PR):
 *   · re-agregar un archivo a `docs/legal/`                     → (A) rojo.
 *   · sembrar `[ABOGADO:` en un `.md` fuera de specs/public/legal → (B) rojo.
 *
 * LÍMITE: esto vigila el ÁRBOL ACTUAL (HEAD). El historial git público conserva lo
 * ya commiteado; purgarlo (filter-repo + force push) es decisión de Jelkin, fuera de
 * este candado (rompería PRs/worktrees abiertos).
 */
import { describe, it, expect } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Los tests unitarios corren con cwd = raíz del producto (002-2026-PROTECCION-INFANTIL/).
const RAIZ = process.cwd();

// Carpetas que NO forman parte del código fuente versionado relevante (y que además
// harían lentísimo —y ruidoso— el barrido si las recorriéramos).
const DIRS_IGNORADOS = new Set([
    "node_modules",
    ".next",
    ".git",
    "coverage",
    "dist",
    "build",
    "playwright-report",
    "test-results",
]);

/** Marcador de hueco de borrador legal: `[ABOGADO: …]`. Con los dos puntos a propósito,
 *  para distinguir el CAMPO real de una mención suelta de la palabra "ABOGADO". */
const MARCADOR_BORRADOR_LEGAL = "[ABOGADO:";

/** Barrido recursivo de archivos bajo `dir` (rutas absolutas); [] si no existe. */
function listarArchivos(dir: string): string[] {
    if (!existsSync(dir)) return [];
    const salida: string[] = [];
    for (const entrada of readdirSync(dir)) {
        if (DIRS_IGNORADOS.has(entrada)) continue;
        const abs = path.join(dir, entrada);
        let esDir = false;
        try {
            esDir = statSync(abs).isDirectory();
        } catch {
            continue; // symlink colgante u otro: ignorar
        }
        if (esDir) salida.push(...listarArchivos(abs));
        else salida.push(abs);
    }
    return salida;
}

/** ¿La ruta relativa (desde RAIZ) está exenta del escaneo de contenido (B)? */
function exentoDeContenido(rel: string): boolean {
    const partes = rel.split(path.sep);
    // public/legal/* (publicados, vigilados aparte) y cualquier árbol specs/ (menciones).
    return rel.startsWith(`public${path.sep}legal${path.sep}`) || partes.includes("specs");
}

describe("higiene del repo público (SPEC-960 · candado B1)", () => {
    // ───────────────────────── (A) estructural: docs/legal/ vacío ─────────────────────────
    describe("(A) no hay borradores legales internos bajo docs/legal/", () => {
        const dirLegal = path.join(RAIZ, "docs", "legal");
        const archivos = listarArchivos(dirLegal);

        it("docs/legal/ no contiene ningún archivo versionado", () => {
            expect(
                archivos,
                "docs/legal/ debe estar VACÍO en el repo público (los borradores viven en el " +
                    "repo privado de gestión). Reaparecieron:\n" +
                    archivos.map((a) => `  · ${path.relative(RAIZ, a)}`).join("\n"),
            ).toEqual([]);
        });
    });

    // ───────────────────── (B) contenido: sin `[ABOGADO:` fuera de specs/public ─────────────────────
    describe("(B) ningún .md (fuera de specs/ y public/legal/) tiene el marcador de borrador legal", () => {
        const mdFiles = listarArchivos(RAIZ)
            .filter((a) => a.endsWith(".md"))
            .map((a) => path.relative(RAIZ, a))
            .filter((rel) => !exentoDeContenido(rel));

        it("barre al menos un .md (el escaneo no quedó vacío por un filtro mal puesto)", () => {
            // Control de que el barrido realmente ve archivos: si fuera 0, (B) sería un
            // falso verde (no probaría ausencia de nada).
            expect(mdFiles.length).toBeGreaterThan(0);
        });

        it("ningún .md contiene `[ABOGADO:`", () => {
            const culpables: string[] = [];
            for (const rel of mdFiles) {
                const contenido = readFileSync(path.join(RAIZ, rel), "utf-8");
                if (contenido.includes(MARCADOR_BORRADOR_LEGAL)) culpables.push(rel);
            }
            expect(
                culpables,
                `El marcador de borrador legal "${MARCADOR_BORRADOR_LEGAL}" no debe aparecer en un ` +
                    ".md servible/versionado del repo público. Aparece en:\n" +
                    culpables.map((c) => `  · ${c}`).join("\n"),
            ).toEqual([]);
        });
    });
});
