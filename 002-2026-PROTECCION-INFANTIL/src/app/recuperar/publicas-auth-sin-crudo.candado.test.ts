/**
 * SPEC-491 · las públicas de auth (recuperar contraseña + reportar) sin crudo.
 *
 * Lección dura (auditoría CEO, 2 veces en este mismo candado): **no armar la
 * lista de escaneo a mano.** Un candado cuyo título nombra una pantalla pero solo
 * escanea el directorio de la ruta certifica en verde una pantalla que SIGUE rota
 * — la pantalla se ARMA desde `components/` (recuperar monta RecuperarForm; reportar
 * monta ReporteWizard + CanalesOficiales). Acá se **resuelve el árbol de render**:
 * se parte de las páginas y se siguen los componentes que MONTAN (imports de
 * `@/components` + relativos), y se escanan esos archivos.
 *
 * Muere por mutación: reintroducir `text-slate-*` en cualquier página o en un
 * componente que ellas montan → rojo.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "..", ".."); // .../src

const PAGINAS = [
    path.join(__dirname, "page.tsx"), // recuperar/page.tsx
    path.join(__dirname, "[token]", "page.tsx"), // recuperar/[token]/page.tsx
    path.resolve(__dirname, "..", "reportar", "page.tsx"), // reportar/page.tsx
];

/** Resuelve un especificador de import a un archivo real bajo src/, o null. */
function resolverImport(spec: string, desde: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(SRC, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
    else return null; // paquete externo
    for (const suf of [".tsx", ".ts", path.join("index.tsx"), path.join("index.ts")]) {
        const cand = suf.startsWith("index") ? path.join(base, suf) : base + suf;
        if (fs.existsSync(cand) && fs.statSync(cand).isFile()) return cand;
    }
    return fs.existsSync(base) && fs.statSync(base).isFile() ? base : null;
}

function importsDe(archivo: string): string[] {
    return [...fs.readFileSync(archivo, "utf-8").matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

/** Páginas + los COMPONENTES que montan (un nivel: el render propio de la pantalla). */
function arbolDeRender(paginas: string[]): string[] {
    const set = new Set<string>(paginas);
    for (const pagina of paginas) {
        for (const spec of importsDe(pagina)) {
            const r = resolverImport(spec, pagina);
            if (r && r.includes(`${path.sep}components${path.sep}`)) set.add(r);
        }
    }
    return [...set];
}

// Con infijo direccional (lección SPEC-490).
const CRUDO = /\b(?:text|bg|border|ring|from|to|via|divide|fill|stroke)(?:-[ltrbxy])?-(?:slate|gray)-[0-9]{2,3}(?:\/[0-9]{1,3})?\b/;

describe("SPEC-491 · públicas de auth (recuperar + reportar) sin slate crudo", () => {
    it("0 crudo slate/gray en el RENDER de recuperar + reportar (páginas + lo que montan)", () => {
        const archivos = arbolDeRender(PAGINAS);
        // Guardas de la propia resolución: si el árbol se rompe, el candado no debe
        // pasar en falso por escanear poco.
        expect(archivos.length, "el árbol de render quedó vacío").toBeGreaterThan(PAGINAS.length);
        expect(archivos.some((a) => a.endsWith("ReporteWizard.tsx")), "el render de reportar debe incluir ReporteWizard").toBe(true);

        const hits: string[] = [];
        for (const archivo of archivos) {
            for (const [i, linea] of fs.readFileSync(archivo, "utf-8").split("\n").entries()) {
                if (CRUDO.test(linea)) hits.push(`${path.relative(SRC, archivo)}:${i + 1}: ${linea.trim().slice(0, 80)}`);
            }
        }
        expect(hits, hits.join("\n")).toEqual([]);
    });
});
