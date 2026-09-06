/**
 * SPEC-491/495 · las públicas de auth + su CHROME sin crudo.
 *
 * Lección dura, tres niveles (auditoría CEO + verificación por HTTP en prod):
 *  1. escanear el directorio de la ruta NO alcanza — la pantalla se arma desde components/.
 *  2. escanear el árbol de imports de la PÁGINA tampoco — falta el layout.
 *  3. **la página renderizada = page.tsx + el/los layout.tsx que la envuelven + TODO lo
 *     que ese chrome monta** (root layout → NavHeader → ThemeToggle). El slate de
 *     ThemeToggle sobrevivió a 3 barridos por esto (I-324).
 *
 * Por eso este candado hace **BFS transitivo** desde las páginas Y los layouts,
 * siguiendo los imports `@/…`/relativos que resuelven a archivos de render bajo
 * `src/` (components/app), con set de visitados. Escanea todo lo alcanzable.
 * Excluye solo tests (Sparkline ya está tokenizada por SPEC-537). Muere por mutación en
 * cualquier nodo del render, incluido el chrome del layout.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src
const APP = path.join(SRC, "app");

// Raíces: las páginas públicas + su cadena de layouts (el chrome las envuelve).
const RAICES = [
    path.join(__dirname, "page.tsx"), // recuperar
    path.join(__dirname, "[token]", "page.tsx"),
    path.join(APP, "reportar", "page.tsx"),
    path.join(APP, "layout.tsx"), // root layout: monta NavHeader → ThemeToggle
    path.join(APP, "reportar", "layout.tsx"),
];

// SPEC-537: Sparkline ya NO se exceptúa — Diseño cerró su escala y quedó tokenizada
// (serie→cielo, ejes→tinta, halo→papel), con su propio candado de mapeo. Solo tests fuera.
const EXCLUYE = /\.test\.tsx?$/;

function resolver(spec: string, desde: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
    else return null;
    for (const cand of [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
    return fs.existsSync(base) && fs.statSync(base).isFile() ? base : null;
}

/** BFS transitivo del árbol de render bajo src/, con visitados. */
function arbolDeRender(raices: string[]): Set<string> {
    const visto = new Set<string>();
    const cola = raices.filter((r) => fs.existsSync(r));
    while (cola.length) {
        const archivo = cola.shift()!;
        if (visto.has(archivo)) continue;
        visto.add(archivo);
        const src = fs.readFileSync(archivo, "utf-8");
        for (const m of src.matchAll(/from\s+["']([^"']+)["']/g)) {
            const r = resolver(m[1], archivo);
            if (r && r.startsWith(SRC) && !visto.has(r)) cola.push(r);
        }
    }
    return visto;
}

const CRUDO = /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:slate|gray)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

describe("SPEC-491/495 · públicas de auth + su chrome sin slate crudo", () => {
    const arbol = [...arbolDeRender(RAICES)].filter((a) => !EXCLUYE.test(a));

    it("el árbol de render incluye el chrome (ThemeToggle vía layout→NavHeader)", () => {
        // Guarda anti-falso-verde: si la resolución no llega al chrome, el candado
        // no debe pasar por escanear poco (así se coló el slate de ThemeToggle).
        expect(arbol.some((a) => a.endsWith("ThemeToggle.tsx")), "el BFS no alcanzó el chrome del layout").toBe(true);
        expect(arbol.some((a) => a.endsWith("ReporteWizard.tsx")), "el BFS no alcanzó ReporteWizard").toBe(true);
    });

    it("0 crudo slate/gray en todo el render (páginas + chrome + lo que montan)", () => {
        const hits: string[] = [];
        for (const archivo of arbol) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (CRUDO.test(linea)) hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 80)}`);
            }
        }
        expect(hits, hits.join("\n")).toEqual([]);
    });
});
