/**
 * SPEC-821 (I-441) · ENUMERADOR: en cada job de `ci.yml`, si un paso ejecuta un script que
 * (transitivamente) importa `src/lib/prisma.ts` (→ `new PrismaClient()`), entonces `npx prisma generate`
 * debe aparecer en un paso ANTERIOR. Si no, el paso explota con `@prisma/client did not initialize yet`
 * — de forma NO determinista, porque solo pasa cuando `npm ci` dejó por casualidad un cliente generado.
 *
 * Es un ENUMERADOR, no una tabla: DESCUBRE los pasos parseando `ci.yml` + resolviendo cada comando a su
 * archivo de script y caminando sus imports. La tabla del radicado es el CONTROL de que los encontró;
 * si este enumerador saca un número distinto, ESE es el hallazgo (no se ajusta el enumerador a la tabla).
 *
 * Parsea el `ci.yml` como TEXTO (igual que trigger-push-main / node-version-paridad): js-yaml no es
 * dependencia directa del producto ni trae tipos, y un parser de subconjunto (jobs → steps → run) alcanza.
 *
 * Alcance del descubrimiento: resuelve pasos que invocan un SCRIPT del producto (`npm run <s>` → el
 * `tsx/node <archivo>` del package.json, o un `tsx/node <archivo>` directo) y camina sus imports locales
 * (relativos + alias `@/`). `prisma generate` se detecta por el comando. Comandos sin archivo de script
 * resoluble (p. ej. `npm ci`, `vitest`/runner por node_modules) no cuentan como «script que importa el
 * cliente»: un runner no es el script, y sus archivos (tests) viven detrás del runner.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { RAIZ_PRODUCTO } from "../arch/lib/paths";

const EXTENSIONES = [".ts", ".tsx", ".mts", ".mjs", ".js", ".cjs"];
/** El módulo que construye `new PrismaClient()` (el singleton). Es el blanco del alcance del radicado. */
const OBJETIVO_REL = path.join("src", "lib", "prisma.ts");

export interface Violacion {
    job: string;
    pasoIndice: number;
    run: string;
    /** El archivo de script (relativo al producto) que importa el cliente. */
    script: string;
}

// ── Parser de subconjunto de ci.yml: por cada job, la lista ORDENADA de valores `run` de sus pasos ──
interface JobRuns {
    job: string;
    runs: string[];
}

export function jobsConRuns(yml: string): JobRuns[] {
    const lineas = yml.split("\n");
    const n = lineas.length;
    let i = 0;
    while (i < n && !/^jobs:\s*$/.test(lineas[i])) i++;
    i++; // primera línea dentro de `jobs:`
    const res: JobRuns[] = [];
    let actual: JobRuns | null = null;
    for (; i < n; i++) {
        const l = lineas[i];
        if (l.trim() === "") continue;
        if (/^\S/.test(l)) break; // volvimos a indent 0 → otra sección top-level, fin de `jobs:`
        const mJob = l.match(/^ {2}([A-Za-z0-9_-]+):\s*$/);
        if (mJob) {
            actual = { job: mJob[1], runs: [] };
            res.push(actual);
            continue;
        }
        if (!actual) continue;
        // `run: |` (bloque multilínea) — capturar las líneas más indentadas que `run:`.
        const mBloque = l.match(/^(\s*)-?\s*run:\s*[|>][-+]?\s*$/);
        if (mBloque) {
            const indentRun = l.indexOf("run:");
            const bloque: string[] = [];
            let j = i + 1;
            for (; j < n; j++) {
                const bl = lineas[j];
                if (bl.trim() !== "" && bl.length - bl.trimStart().length <= indentRun) break;
                bloque.push(bl.trimStart());
            }
            actual.runs.push(bloque.join("\n"));
            i = j - 1;
            continue;
        }
        // `run: <cmd>` en una línea (con o sin el `-` del paso).
        const mInline = l.match(/^\s*-?\s*run:\s+(\S.*)$/);
        if (mInline) actual.runs.push(mInline[1].trim());
    }
    return res;
}

// ── Grafo de imports: ¿`entry` alcanza src/lib/prisma.ts? ──
function resolverEspecificador(spec: string, desdeDir: string, productoDir: string): string | null {
    let base: string;
    if (spec.startsWith("@/")) base = path.join(productoDir, "src", spec.slice(2));
    else if (spec.startsWith("./") || spec.startsWith("../")) base = path.resolve(desdeDir, spec);
    else return null; // externo (node_modules): no es un archivo local del producto
    if (base.includes("node_modules")) return null;
    if (fs.existsSync(base) && fs.statSync(base).isFile()) return base;
    for (const e of EXTENSIONES) if (fs.existsSync(base + e)) return base + e;
    for (const e of EXTENSIONES) {
        const idx = path.join(base, "index" + e);
        if (fs.existsSync(idx)) return idx;
    }
    return null;
}

function extraerImports(contenido: string): string[] {
    const specs: string[] = [];
    const regexes = [
        /\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g,
        /\bimport\s*['"]([^'"]+)['"]/g,
        /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
        /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    ];
    for (const re of regexes) {
        let m: RegExpExecArray | null;
        while ((m = re.exec(contenido)) !== null) specs.push(m[1]);
    }
    return specs;
}

/** ¿`entry` alcanza (transitivamente, por imports LOCALES) a `src/lib/prisma.ts`? */
export function importaElCliente(entry: string, productoDir: string): boolean {
    const objetivo = path.resolve(productoDir, OBJETIVO_REL);
    const visto = new Set<string>();
    const cola = [path.resolve(entry)];
    while (cola.length > 0) {
        const archivo = cola.pop() as string;
        if (visto.has(archivo)) continue;
        visto.add(archivo);
        if (archivo === objetivo) return true;
        let contenido: string;
        try {
            contenido = fs.readFileSync(archivo, "utf-8");
        } catch {
            continue;
        }
        for (const spec of extraerImports(contenido)) {
            const resuelto = resolverEspecificador(spec, path.dirname(archivo), productoDir);
            if (resuelto) cola.push(path.resolve(resuelto));
        }
    }
    return false;
}

// ── Resolver un `run` a (es-generate? + archivos de script) ──
interface ComandoResuelto {
    esGenerate: boolean;
    scripts: string[];
}

function resolverComando(cmd: string, productoDir: string, scriptsPkg: Record<string, string>, profundidad = 0): ComandoResuelto {
    const out: ComandoResuelto = { esGenerate: false, scripts: [] };
    if (profundidad > 10) return out;
    const subs = cmd.split(/&&|\|\||;|\n/).map((s) => s.trim()).filter(Boolean);
    for (const sub of subs) {
        if (/\bprisma\b/.test(sub) && /\bgenerate\b/.test(sub)) {
            out.esGenerate = true;
            continue;
        }
        const mRun = sub.match(/\bnpm\s+run\s+(\S+)/);
        if (mRun && scriptsPkg[mRun[1]]) {
            const r = resolverComando(scriptsPkg[mRun[1]], productoDir, scriptsPkg, profundidad + 1);
            out.esGenerate = out.esGenerate || r.esGenerate;
            out.scripts.push(...r.scripts);
            continue;
        }
        for (const tok of sub.split(/\s+/)) {
            if (!/\.(ts|tsx|mts|mjs|js|cjs)$/.test(tok)) continue;
            if (tok.includes("node_modules")) continue;
            const abs = path.isAbsolute(tok) ? tok : path.join(productoDir, tok);
            if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
                out.scripts.push(abs);
                break;
            }
        }
    }
    return out;
}

/**
 * Descubre, por cada job de `ci.yml`, los pasos que ejecutan un script que importa el cliente y corren
 * ANTES (o sin) `prisma generate`. Recibe el CONTENIDO del yaml (para que el control positivo pueda
 * mutarlo en memoria) y el directorio del producto.
 */
export function enumerarViolaciones(ciYmlContent: string, productoDir: string): Violacion[] {
    const pkg = JSON.parse(fs.readFileSync(path.join(productoDir, "package.json"), "utf-8")) as {
        scripts?: Record<string, string>;
    };
    const scriptsPkg = pkg.scripts ?? {};
    const violaciones: Violacion[] = [];

    for (const { job, runs } of jobsConRuns(ciYmlContent)) {
        const resueltos = runs.map((run) => resolverComando(run, productoDir, scriptsPkg));
        const genIdx = resueltos.findIndex((r) => r.esGenerate);
        resueltos.forEach((r, i) => {
            for (const script of r.scripts) {
                if (!importaElCliente(script, productoDir)) continue;
                if (genIdx === -1 || i < genIdx) {
                    violaciones.push({
                        job,
                        pasoIndice: i,
                        run: runs[i].split("\n")[0].trim().slice(0, 80),
                        script: path.relative(productoDir, script),
                    });
                }
            }
        });
    }
    return violaciones;
}

export const RUTA_CI_YML = path.join(RAIZ_PRODUCTO, "..", ".github", "workflows", "ci.yml");

export function enumerarViolacionesReales(): Violacion[] {
    return enumerarViolaciones(fs.readFileSync(RUTA_CI_YML, "utf-8"), RAIZ_PRODUCTO);
}

// CLI: imprime las violaciones y sale con código ≠0 si hay alguna.
if (process.argv[1] && /prisma-generate-antes-del-cliente\.ts$/.test(process.argv[1])) {
    const v = enumerarViolacionesReales();
    if (v.length === 0) {
        console.log("[ci-orden] VERDE: ningún script que importa el cliente corre antes de `prisma generate`.");
    } else {
        console.error(`[ci-orden] ROJO: ${v.length} paso(s) importan el cliente antes de generate:`);
        for (const x of v) console.error(`  · job=${x.job} paso#${x.pasoIndice} [${x.script}] → ${x.run}`);
        process.exitCode = 1;
    }
}
