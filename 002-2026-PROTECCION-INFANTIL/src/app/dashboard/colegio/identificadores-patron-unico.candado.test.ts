/**
 * CANDADO · SPEC-932 — los 4 sujetos del colegio gestionan identificadores con EL MISMO componente.
 *
 * Antes había 3 implementaciones que divergían (comité: form inline + `<ul>`, sin Plataforma ni Editar;
 * estudiante: sin Editar). FORMA SPEC-931 §6: un solo componente, consumido por los 4. Este candado amarra:
 *
 *   (1) ÁRBOL DE RENDER por RAÍZ: desde cada una de las 4 pantallas (profesor, estudiante, acudiente, comité) el
 *       BFS de imports LOCALES alcanza `IdentificadoresParaAlertas.tsx`. Cada raíz se recorre EXCLUYENDO a las
 *       otras raíces: el estudiante no puede «heredar» el componente a través de `SeccionAcudientes`.
 *       El walker sigue `import … from`, `import "…"` y `export … from` (barrels) — ciego a esto daba 0 nodos.
 *   (2) MUTACIÓN POR RAÍZ: a cada raíz se le quita su import del componente (en memoria) → deja de alcanzarlo.
 *   (3) UNA SOLA IMPLEMENTACIÓN: el modal «Editar identificador» existe en UN solo archivo del colegio (el
 *       componente). Una pantalla que vuelva a armar su propio modal → rojo.
 *   (4) Control POSITIVO del walker con un árbol sintético (barrel `export { X } from`).
 *
 * Unit puro (fs). En `vitest.unit.includes.ts`.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const SRC = path.resolve(__dirname, "../../..");
const COMPONENTE = path.join(SRC, "components/modules/colegio/identificadores/IdentificadoresParaAlertas.tsx");

const RAICES: Record<string, string> = {
    profesor: path.join(SRC, "app/dashboard/colegio/profesores/[id]/ProfesorDetallePageClient.tsx"),
    estudiante: path.join(SRC, "app/dashboard/colegio/alumnos/[id]/AlumnoDetallePageClient.tsx"),
    acudiente: path.join(SRC, "app/dashboard/colegio/alumnos/[id]/SeccionAcudientes.tsx"),
    comite: path.join(SRC, "app/dashboard/colegio/comite/integrantes/[id]/identificadores/page.tsx"),
};

const EXT = ["", ".tsx", ".ts", "/index.tsx", "/index.ts"];
const IMPORT_RE = /(?:import|export)\s[\s\S]*?\sfrom\s*["']([^"']+)["']|import\s*["']([^"']+)["']/g;

function resolver(spec: string, desde: string, srcRoot: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(srcRoot, spec.slice(2));
    else if (spec.startsWith(".")) base = path.resolve(path.dirname(desde), spec);
    else return null; // paquete externo
    for (const e of EXT) {
        const f = base + e;
        if (fs.existsSync(f) && fs.statSync(f).isFile()) return f;
    }
    return null;
}

/** BFS de imports locales desde `raiz`. `leer` permite mutar el código en memoria; `excluir` corta nodos. */
export function alcanza(
    raiz: string,
    objetivo: string,
    srcRoot: string,
    opts: { excluir?: Set<string>; leer?: (f: string) => string } = {},
): { alcanza: boolean; nodos: number } {
    const leer = opts.leer ?? ((f: string) => fs.readFileSync(f, "utf-8"));
    const vistos = new Set<string>([raiz]);
    const cola = [raiz];
    while (cola.length) {
        const f = cola.shift()!;
        if (f === objetivo) return { alcanza: true, nodos: vistos.size };
        for (const m of leer(f).matchAll(IMPORT_RE)) {
            const dest = resolver(m[1] ?? m[2], f, srcRoot);
            if (!dest || vistos.has(dest) || opts.excluir?.has(dest)) continue;
            vistos.add(dest);
            cola.push(dest);
        }
    }
    return { alcanza: false, nodos: vistos.size };
}

function* recorrer(dir: string): Generator<string> {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = path.join(dir, e.name);
        if (e.isDirectory()) yield* recorrer(r);
        else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) yield r;
    }
}

describe("SPEC-932 · un solo componente de identificadores para los 4 sujetos", () => {
    it("(1) cada raíz alcanza IdentificadoresParaAlertas por SU árbol (sin pasar por otra raíz)", () => {
        expect(fs.existsSync(COMPONENTE), "no existe el componente único").toBe(true);
        for (const [sujeto, raiz] of Object.entries(RAICES)) {
            expect(fs.existsSync(raiz), `${sujeto}: no existe la raíz ${raiz}`).toBe(true);
            const otras = new Set(Object.values(RAICES).filter((r) => r !== raiz));
            const r = alcanza(raiz, COMPONENTE, SRC, { excluir: otras });
            expect(r.alcanza, `${sujeto}: su pantalla NO renderiza el componente único`).toBe(true);
        }
    });

    it("(2) MUTACIÓN por raíz: sin su import del componente, la raíz deja de alcanzarlo", () => {
        for (const [sujeto, raiz] of Object.entries(RAICES)) {
            const otras = new Set(Object.values(RAICES).filter((r) => r !== raiz));
            // Para el comité la raíz es el page.tsx: se muta el client que importa el componente.
            const leer = (f: string) => {
                const codigo = fs.readFileSync(f, "utf-8");
                return f === raiz || (sujeto === "comite" && f.endsWith("IdentificadoresIntegranteClient.tsx"))
                    ? codigo.replace(/import\s*\{[^}]*\}\s*from\s*["'][^"']*IdentificadoresParaAlertas["'];?/g, "")
                    : codigo;
            };
            const r = alcanza(raiz, COMPONENTE, SRC, { excluir: otras, leer });
            expect(r.alcanza, `${sujeto}: la mutación no cortó el camino (el candado no lo vigila)`).toBe(false);
            expect(r.nodos, `${sujeto}: el walker no recorrió nada`).toBeGreaterThan(1);
        }
    });

    it("(3) UNA sola implementación: el modal «Editar identificador» vive solo en el componente", () => {
        const dueños: string[] = [];
        for (const dir of ["app/dashboard/colegio", "components/modules/colegio"]) {
            for (const f of recorrer(path.join(SRC, dir))) {
                if (fs.readFileSync(f, "utf-8").includes("Editar identificador")) dueños.push(path.relative(SRC, f));
            }
        }
        expect(dueños).toEqual([path.relative(SRC, COMPONENTE)]);
    });

    it("(4) control POSITIVO del walker: barrel `export { X } from` se sigue; sin el import, no", () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec932-"));
        try {
            fs.mkdirSync(path.join(tmp, "comp"));
            fs.writeFileSync(path.join(tmp, "comp/Objetivo.tsx"), "export function Objetivo() { return null; }\n");
            fs.writeFileSync(path.join(tmp, "comp/index.ts"), 'export { Objetivo } from "./Objetivo";\n');
            fs.writeFileSync(path.join(tmp, "Raiz.tsx"), 'import { Objetivo } from "@/comp";\nexport default Objetivo;\n');
            fs.writeFileSync(path.join(tmp, "Sola.tsx"), "export default function Sola() { return null; }\n");
            const obj = path.join(tmp, "comp/Objetivo.tsx");
            expect(alcanza(path.join(tmp, "Raiz.tsx"), obj, tmp).alcanza).toBe(true);
            expect(alcanza(path.join(tmp, "Sola.tsx"), obj, tmp).alcanza).toBe(false);
        } finally {
            fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 3 });
        }
    });
});
