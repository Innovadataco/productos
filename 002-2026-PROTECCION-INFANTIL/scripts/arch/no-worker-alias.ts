/**
 * SPEC-197 (I-88): anti-alias en la cadena de imports de los scripts de worker.
 *
 * Los scripts `.mjs` de worker corren con `node --import tsx`, donde los imports
 * alias `@/lib/...` no siempre se resuelven (a diferencia del build de Next.js).
 * Esta regla recorre la clausura de imports de los scripts de worker y exige
 * que los archivos bajo `src/lib/monitoreo/**` usen imports relativos, y que
 * cualquier otro archivo en la clausura con alias `@/lib/` esté declarado en la
 * allowlist (deuda heredada que solo puede encoger).
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RUTA_PRODUCTO = path.resolve(AQUI, "..", "..");
const RUTA_SRC = path.join(RUTA_PRODUCTO, "src");
const RUTA_SCRIPTS = path.join(RUTA_PRODUCTO, "scripts");
const RUTA_ALLOWLIST = path.join(AQUI, "worker-alias-allowlist.json");

const SCRIPTS_WORKER = [
    "worker-supervisor.mjs",
    "worker-reportes.mjs",
    "monitor-probes.mjs",
    "simulador-abuso.mjs",
];

export interface InfractorWorkerAlias {
    archivo: string;
    import: string;
}

function relativa(absoluta: string): string {
    return path.relative(RUTA_SRC, absoluta).split(path.sep).join("/");
}

function resolverImport(origen: string, desde: string): string | null {
    if (origen.startsWith("@/")) {
        return path.join(RUTA_SRC, origen.slice(2));
    }
    if (origen.startsWith("./") || origen.startsWith("../")) {
        return path.resolve(path.dirname(desde), origen);
    }
    return null;
}

function conExtension(p: string): string | null {
    for (const ext of ["", ".ts", ".tsx", ".mjs", ".js"]) {
        const completo = p + ext;
        if (fs.existsSync(completo) && fs.statSync(completo).isFile()) return completo;
    }
    for (const ext of [".ts", ".tsx", ".mjs", ".js"]) {
        const completo = path.join(p, "index" + ext);
        if (fs.existsSync(completo) && fs.statSync(completo).isFile()) return completo;
    }
    return null;
}

function obtenerImports(archivo: string): string[] {
    const fuente = fs.readFileSync(archivo, "utf8");
    const sf = ts.createSourceFile(archivo, fuente, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const imports: string[] = [];
    function visitar(nodo: ts.Node) {
        if (ts.isImportDeclaration(nodo) || ts.isExportDeclaration(nodo)) {
            const especificador = nodo.moduleSpecifier;
            if (especificador && ts.isStringLiteral(especificador)) {
                imports.push(especificador.text);
            }
        }
        ts.forEachChild(nodo, visitar);
    }
    visitar(sf);
    return imports;
}

function importsAlias(archivo: string): string[] {
    return obtenerImports(archivo).filter((imp) => imp.startsWith("@/lib/"));
}

function cargarAllowlist(): Set<string> {
    const raw = JSON.parse(fs.readFileSync(RUTA_ALLOWLIST, "utf8")) as { archivos: string[] };
    return new Set(raw.archivos);
}

export function buscarInfractores(): InfractorWorkerAlias[] {
    const allowlist = cargarAllowlist();
    const visitados = new Set<string>();
    const infractores: InfractorWorkerAlias[] = [];

    function recorrer(archivo: string) {
        const real = conExtension(archivo);
        if (!real || visitados.has(real)) return;
        visitados.add(real);

        const rel = "src/" + relativa(real);
        const esMonitoreo = rel.startsWith("src/lib/monitoreo/");
        const alias = importsAlias(real);

        if (alias.length > 0) {
            if (esMonitoreo || !allowlist.has(rel)) {
                for (const imp of alias) {
                    infractores.push({ archivo: rel, import: imp });
                }
            }
        }

        for (const imp of obtenerImports(real)) {
            const resuelto = resolverImport(imp, real);
            if (resuelto) recorrer(resuelto);
        }
    }

    for (const script of SCRIPTS_WORKER) {
        recorrer(path.join(RUTA_SCRIPTS, script));
    }

    return infractores;
}

// CLI: `npx tsx scripts/arch/no-worker-alias.ts`
if (import.meta.url === `file://${process.argv[1]}`) {
    const infractores = buscarInfractores();
    if (infractores.length === 0) {
        console.log("[no-worker-alias] VERDE: cero alias @/lib/ en la cadena de worker fuera de la allowlist.");
    } else {
        console.error(`[no-worker-alias] ROJO: ${infractores.length} alias @/lib/ no permitidos en la cadena de worker:`);
        for (const f of infractores) console.error(`  - ${f.archivo} · ${f.import}`);
        process.exitCode = 1;
    }
}
