/**
 * CANDADO · SPEC-804 — ningún test ESCRIBE dentro de `src/`.
 *
 * La causa de la carrera (ENOENT: scandir, con víctima rotando) era un test que plantaba un
 * directorio temporal DENTRO de `src/`, que varios candados caminan en paralelo. El arreglo
 * estructural: el temporal sale de `src/`. Este candado impide que la clase reaparezca —barre TODOS
 * los tests (no una lista) y falla si alguno construye un path bajo el `src/` del repo y escribe.
 *
 * Detección (heurística conductual, no una lista de archivos): un `path.join/resolve` cuya BASE es la
 * raíz del repo (`RAIZ` / `__dirname` / `process.cwd()`) con un segmento `"src"`, EN un archivo que
 * además tiene una escritura fs. Un fixture en el tmpdir del sistema (`path.join(base, "src", …)` con
 * base de `mkdtempSync`) NO matchea: su base no es la raíz del repo. Control positivo abajo.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const AQUI = dirname(fileURLToPath(import.meta.url)); // …/scripts
const RAIZ = resolve(AQUI, "..");

const PATH_BAJO_SRC_DEL_REPO =
    /path\.(?:join|resolve)\(\s*(?:RAIZ|__dirname|process\.cwd\(\))[^)]*?["']src["']/;
const ESCRITURA_FS =
    /(?:fs\.)?(?:writeFileSync|mkdirSync|appendFileSync|cpSync|copyFileSync|mkdtempSync|writeSync|createWriteStream)\s*\(/;

/** ¿El contenido de un test construye un path bajo el `src/` del REPO y además escribe? */
export function escribeBajoSrcDelRepo(contenido: string): boolean {
    return PATH_BAJO_SRC_DEL_REPO.test(contenido) && ESCRITURA_FS.test(contenido);
}

function* recorrerTests(dir: string): Generator<string> {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        if (e.name === "node_modules" || e.name === ".next") continue;
        const ruta = join(dir, e.name);
        if (e.isDirectory()) yield* recorrerTests(ruta);
        else if (/\.test\.tsx?$/.test(e.name)) yield ruta;
    }
}

describe("SPEC-804 · ningún test escribe dentro de `src/`", () => {
    it("barrido de TODOS los tests: ninguno construye un path bajo src/ del repo y escribe", () => {
        const culpables: string[] = [];
        const ESTE_ARCHIVO = fileURLToPath(import.meta.url); // este candado cita el patrón como fixture
        for (const base of [join(RAIZ, "src"), join(RAIZ, "scripts")]) {
            for (const ruta of recorrerTests(base)) {
                if (ruta === ESTE_ARCHIVO) continue;
                if (escribeBajoSrcDelRepo(readFileSync(ruta, "utf8"))) {
                    culpables.push(ruta.replace(RAIZ + "/", ""));
                }
            }
        }
        expect(culpables, `tests que escriben bajo src/ (carrera TOCTOU con los walkers): ${culpables.join(" · ")}`).toEqual([]);
    });

    it("CONTROL POSITIVO: el detector caza el patrón prohibido y no el del tmpdir", () => {
        // prohibido: path bajo el src/ del repo + escritura
        expect(escribeBajoSrcDelRepo('const d = path.join(RAIZ, "src", "__tmp__"); fs.mkdirSync(d);')).toBe(true);
        expect(escribeBajoSrcDelRepo('fs.writeFileSync(path.resolve(__dirname, "..", "src", "x.tsx"), "y");')).toBe(true);
        // permitido: fixture en tmpdir (base de mkdtempSync), aunque tenga un segmento "src"
        expect(escribeBajoSrcDelRepo('const base = fs.mkdtempSync(os.tmpdir()); fs.writeFileSync(path.join(base, "src", "A.tsx"), "z");')).toBe(false);
        // permitido: LEER un archivo de src/ (sin escritura) no es la clase
        expect(escribeBajoSrcDelRepo('const c = readFileSync(path.join(__dirname, "..", "src", "a.tsx"), "utf8");')).toBe(false);
    });
});
