/**
 * SPEC-536 (último bloque mecánico de color) · CANDADO de clase.
 *
 * Barrido color→token (§4.2) de tres pantallas de admin:
 *  - AdminReportesTable (bandeja, 11) — chrome slate→tinta; badge «Eliminado»→rubi.
 *  - PermisosRolPanel (AD-06, 8) — mensajes éxito→estado-pino / error→estado-rubi;
 *    divisor→tinta.
 *  - AdminAntiAbusoSimulador (AD-14, 8) — pestaña activa, caja de sugerencia (info)
 *    → cielo/estado-cielo.
 *
 * NO es lista de archivos a mano: sigue el ÁRBOL DE RENDER de cada pantalla desde su
 * raíz por imports de primer partido bajo components/modules (lección SPEC-491).
 *
 * FRONTERA de propiedad: `AdminAntiAbusoSimuladorHistorial` está en el árbol del
 * simulador pero es cancha de Dev 1 (#458, gráficas/tabla de anti-abuso); SPEC-536
 * NO lo toca. Se excluye de la aserción de cero-crudo, y se verifica que SIGUE en el
 * árbol (la frontera es real, no letra muerta). El resto del árbol sí se vigila.
 *
 * Muere con el defecto: reintroducir un crudo en cualquier archivo vigilado
 * → rojo con archivo:línea.
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

const ROOTS = [
    path.join(MODULES, "AdminReportesTable.tsx"),
    path.join(MODULES, "PermisosRolPanel.tsx"),
    path.join(MODULES, "AdminAntiAbusoSimulador.tsx"),
];
// Cancha de Dev 1 (#458): excluida de cero-crudo, pero DEBE seguir en el árbol.
const FRONTERA_DEV1 = [path.join(MODULES, "AdminAntiAbusoSimuladorHistorial.tsx")];

const RAW_TREE = arbolDeRender(ROOTS);
const TREE = RAW_TREE.filter((f) => !FRONTERA_DEV1.includes(f));

// Archivos que SPEC-536 tocó (incluye el residual +1 AdminReporteDetalle, borde de
// Alerta error que el mapa no contó); el árbol DEBE alcanzarlos (anti-falso-verde).
const TOCADOS = [
    "AdminReportesTable.tsx",
    "PermisosRolPanel.tsx",
    "AdminAntiAbusoSimulador.tsx",
    "AdminReporteDetalle.tsx",
].map((r) => path.join(MODULES, r));

describe("SPEC-536 · la regex CRUDO caza el defecto y respeta los tokens", () => {
    it("caza familia + escala, con direccional y opacidad", () => {
        expect(CRUDO.test("bg-slate-100")).toBe(true);
        expect(CRUDO.test("text-sky-700")).toBe(true);
        expect(CRUDO.test("border-l-emerald-500")).toBe(true);
        expect(CRUDO.test("dark:bg-red-900/40")).toBe(true);
    });
    it("NO marca los tokens del sistema", () => {
        expect(CRUDO.test("bg-tinta/10")).toBe(false);
        expect(CRUDO.test("text-estado-rubi")).toBe(false);
        expect(CRUDO.test("border-cielo")).toBe(false);
        expect(CRUDO.test("text-estado-pino")).toBe(false);
    });
});

describe("SPEC-536 · anti-falso-verde: árbol construido, frontera real, tocados alcanzados", () => {
    it("descubrió el árbol, no un conjunto vacío", () => {
        expect(TREE.length).toBeGreaterThanOrEqual(TOCADOS.length);
    });
    it("la frontera Dev1 sigue montada en el árbol (exclusión viva, no letra muerta)", () => {
        for (const f of FRONTERA_DEV1) {
            expect(RAW_TREE.includes(f), `${path.relative(SRC, f)} ya no está en el árbol; quitá la frontera`).toBe(true);
        }
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

describe("SPEC-536 · cero color crudo en el árbol de render (menos la frontera Dev1)", () => {
    it("ningún archivo vigilado contiene color crudo de Tailwind", () => {
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
