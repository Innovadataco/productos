/**
 * SPEC-535 (PA-24 «Mis reportes» · PA-08 detalle del reporte) · CANDADO de clase.
 *
 * Barrido color→token (§4.2) de los badges de estado del reporte del PADRE:
 * warning→`estado-ambar`, éxito→`estado-pino`, clasificación (info)→`estado-cielo`
 * (sobre `bg-{token}/10`). Sin color CRUDO de Tailwind (incl. direccional `-l/-t/…`
 * y opacidad `…/40`). Diseño lo certificó mecánico; NO es data-viz.
 *
 * Estas dos pantallas viven en `components/modules/` (NO en `.../padre/`), por eso
 * el barrido por-directorio de Diseño no las tocó. El candado NO escanea directorio:
 * sigue el ÁRBOL DE RENDER de cada pantalla desde su raíz por sus imports de primer
 * partido bajo `components/modules`.
 *
 * Muere con el defecto: reintroducir un crudo en cualquier archivo del árbol
 * → rojo con `archivo:línea`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const MODULES = path.resolve(__dirname); // src/components/modules
const SRC = path.resolve(__dirname, "..", ".."); // src

const CRUDO =
    /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|slate|gray|zinc|neutral|stone)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

const TOKEN =
    /\b(?:text|bg|border|ring|divide|from|to)-(?:estado-)?(?:pino|ambar|rubi|cielo|tinta|papel)\b/;

function resolveImport(spec: string, fromDir: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(fromDir, spec);
    else return null;
    for (const c of [base + ".tsx", base + ".ts", path.join(base, "index.tsx"), path.join(base, "index.ts")]) {
        if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
    }
    return null;
}

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

// Raíces de pantalla (CEO SPEC-535): la lista «Mis reportes» y el detalle del reporte.
const ROOTS = [path.join(MODULES, "MisReportesList.tsx"), path.join(MODULES, "MisReporteDetalle.tsx")];
const TREE = arbolDeRender(ROOTS);

const TOCADOS = ["MisReportesList.tsx", "MisReporteDetalle.tsx"].map((r) => path.join(MODULES, r));

describe("SPEC-535 · la regex CRUDO caza el defecto y respeta los tokens", () => {
    it("caza familia + escala, con direccional y opacidad", () => {
        expect(CRUDO.test("bg-sky-50")).toBe(true);
        expect(CRUDO.test("dark:bg-sky-950/40")).toBe(true);
        expect(CRUDO.test("text-amber-700")).toBe(true);
        expect(CRUDO.test("border-l-emerald-500")).toBe(true);
    });
    it("NO marca los tokens del sistema", () => {
        expect(CRUDO.test("bg-ambar/10")).toBe(false);
        expect(CRUDO.test("text-estado-pino")).toBe(false);
        expect(CRUDO.test("text-estado-cielo")).toBe(false);
        expect(CRUDO.test("bg-tinta/5")).toBe(false);
    });
});

describe("SPEC-535 · anti-falso-verde: el árbol se construyó y alcanzó lo tocado", () => {
    it("descubrió el árbol, no un conjunto vacío", () => {
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

describe("SPEC-535 · cero color crudo en el árbol de render de las pantallas del padre", () => {
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
