/**
 * SPEC-534 (AD-16 configuración · CV-02 solicitudes de comité) · CANDADO de clase.
 *
 * Barrido color→token (§4.2): las pantallas de configuración y de solicitudes de
 * comité no pueden contener color CRUDO de Tailwind (`text-red-500`, `bg-slate-…`,
 * incl. variantes direccionales `border-l-…` y opacidad `…/30`). El estado va a
 * ambar/cielo/pino/rubi (texto vía `text-estado-*`), el chrome a `tinta`, la
 * superficie a `papel`. Los primitivos de `components/ui` tienen su propio candado.
 *
 * NO es una lista de archivos a mano (eso repite el gap de SPEC-491): se sigue el
 * ÁRBOL DE RENDER de cada pantalla —desde su componente raíz, por sus imports de
 * primer partido bajo `components/modules`— y se escanea cada archivo montado.
 *
 * Muere con el defecto: reintroducir un crudo en CUALQUIER archivo del árbol
 * (p.ej. `text-red-500` en TimelineSection, o `border-l-emerald-500` en un chip)
 * → rojo con `archivo:línea`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MODULES = path.resolve(__dirname); // src/components/modules
const SRC = path.resolve(__dirname, "..", ".."); // src

// Color crudo de Tailwind: familia + escala numérica, con infijo direccional
// (-l/-t/-r/-b/-x/-y) y opacidad opcional (SPEC-490: sin el infijo, el patrón pasa
// dejando `border-l-emerald-500`).
const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral|stone)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

// Marca de que el swap ocurrió: una utilidad tokenizada REAL (no una palabra suelta
// en un comentario). Impide el falso verde de "archivo vacío / desaparecido".
const TOKEN =
    /\b(?:text|bg|border|ring|divide|from|to)-(?:estado-)?(?:pino|ambar|rubi|cielo|tinta|papel)\b/;

function resolveImport(spec: string, fromDir: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(fromDir, spec);
    else return null; // paquete externo: fuera del boundary
    for (const c of [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
}

/** BFS por el árbol de render, acotado a `components/modules`. Rutas absolutas. */
function arbolDeRender(roots: string[]): string[] {
    const boundary = MODULES + path.sep;
    const seen = new Set<string>();
    const cola = [...roots];
    const RE = /from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|(?:^|\n)\s*import\s+["']([^"']+)["']/g;
    while (cola.length) {
        const f = cola.shift() as string;
        if (seen.has(f)) continue;
        seen.add(f);
        const src = fs.readFileSync(f, "utf-8");
        let m: RegExpExecArray | null;
        while ((m = RE.exec(src)) !== null) {
            const spec = m[1] || m[2] || m[3];
            if (!spec) continue;
            const r = resolveImport(spec, path.dirname(f));
            if (r && r.startsWith(boundary) && !seen.has(r)) cola.push(r);
        }
    }
    return [...seen].filter((p) => p.startsWith(boundary));
}

// Raíces de pantalla (CEO SPEC-534): el panel de configuración monta `config-panel/*`
// y `CategoriaGruposEditor`; el detalle de solicitud de comité es su propia pantalla.
const ROOTS = [path.join(MODULES, "ConfigPanel.tsx"), path.join(MODULES, "ComiteSolicitudDetalle.tsx")];
const TREE = arbolDeRender(ROOTS);

// Archivos que SPEC-534 tocó y que el árbol DEBE alcanzar (anti-falso-verde).
const TOCADOS = [
    "ConfigPanel.tsx",
    "config-panel/ConfigSection.tsx",
    "config-panel/ParamRow.tsx",
    "config-panel/TimelineSection.tsx",
    "CategoriaGruposEditor.tsx",
    "ComiteSolicitudDetalle.tsx",
].map((r) => path.join(MODULES, r));

describe("SPEC-534 · la regex CRUDO caza el defecto y respeta los tokens", () => {
    it("caza familia + escala, con direccional y opacidad", () => {
        expect(CRUDO.test("text-red-500")).toBe(true);
        expect(CRUDO.test("border-l-emerald-500")).toBe(true);
        expect(CRUDO.test("bg-red-950/30")).toBe(true);
        expect(CRUDO.test("divide-slate-800")).toBe(true);
    });
    it("NO marca los tokens del sistema", () => {
        expect(CRUDO.test("text-estado-rubi")).toBe(false);
        expect(CRUDO.test("bg-rubi/10")).toBe(false);
        expect(CRUDO.test("border-tinta/10")).toBe(false);
        expect(CRUDO.test("bg-papel")).toBe(false);
    });
});

describe("SPEC-534 · anti-falso-verde: el árbol se construyó y alcanzó lo tocado", () => {
    it("descubrió el árbol de módulo completo, no un conjunto vacío", () => {
        expect(TREE.length).toBeGreaterThanOrEqual(TOCADOS.length);
    });
    it.each(TOCADOS.map((f) => [path.relative(SRC, f), f] as const))(
        "alcanza y tokenizó %s",
        (rel, f) => {
            expect(TREE.includes(f), `el árbol de render no alcanzó ${rel}`).toBe(true);
            const src = fs.readFileSync(f, "utf-8");
            expect(src.length).toBeGreaterThan(200);
            expect(TOKEN.test(src), `${rel} no contiene ninguna utilidad tokenizada`).toBe(true);
        },
    );
});

describe("SPEC-534 · cero color crudo en el árbol de render de las pantallas", () => {
    it("ningún archivo montado contiene color crudo de Tailwind", () => {
        const hits: string[] = [];
        for (const f of TREE) {
            const lines = fs.readFileSync(f, "utf-8").split("\n");
            lines.forEach((ln, i) => {
                if (CRUDO.test(ln)) hits.push(`${path.relative(SRC, f)}:${i + 1}  ${ln.trim()}`);
            });
        }
        expect(hits, `crudo remanente:\n${hits.join("\n")}`).toEqual([]);
    });
});
