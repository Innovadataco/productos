/**
 * SPEC-287 (002-PI-187) · Ratchet 1 — `no-x-invoke-path`.
 *
 * El header `x-invoke-path` NO existe en Next 15 App Router Server Components
 * (era interno de Next 12/13 en Edge del `pages` router). Leerlo devuelve
 * siempre `null` en el runtime actual — causa raíz de I-141. Este ratchet
 * bloquea el merge si alguien lo vuelve a introducir.
 *
 * Exit codes: 0 = verde, 1 = ocurrencias detectadas, 2 = error I/O.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

export interface Ocurrencia {
    file: string; // ruta relativa a la raíz del proyecto
    line: number;
    text: string;
}

function caminar(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        // Saltar carpetas de infraestructura para no perder tiempo.
        if (entry === "node_modules" || entry === ".next" || entry === "coverage") continue;
        const full = join(dir, entry);
        const s = statSync(full);
        if (s.isDirectory()) caminar(full, out);
        else if (/\.(ts|tsx|mjs)$/.test(entry)) out.push(full);
    }
    return out;
}

export function buscarXInvokePath(srcDir: string): Ocurrencia[] {
    const archivos = caminar(srcDir);
    const ocurrencias: Ocurrencia[] = [];
    for (const f of archivos) {
        const texto = readFileSync(f, "utf8");
        const lineas = texto.split("\n");
        for (let i = 0; i < lineas.length; i++) {
            if (/x-invoke-path/i.test(lineas[i])) {
                ocurrencias.push({ file: relative(process.cwd(), f), line: i + 1, text: lineas[i].trim() });
            }
        }
    }
    return ocurrencias;
}

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("no-x-invoke-path.ts") || process.argv[1].endsWith("no-x-invoke-path.js"));

if (esEntry) {
    try {
        const ocurrencias = buscarXInvokePath(join(process.cwd(), "src"));
        if (ocurrencias.length > 0) {
            for (const o of ocurrencias) {
                console.error(`[LINT no-x-invoke-path] ${o.file}:${o.line}  ${o.text}`);
            }
            console.error(
                `[LINT no-x-invoke-path] FALLO — ${ocurrencias.length} ocurrencias. ` +
                    "Ese header no existe en Next 15 App Router (causa raíz I-141). Usa request.nextUrl.pathname en middleware.",
            );
            process.exit(1);
        }
        console.log("[LINT no-x-invoke-path] OK — cero ocurrencias en src/");
    } catch (error) {
        console.error(`[LINT no-x-invoke-path] Error de infraestructura: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
    }
}
