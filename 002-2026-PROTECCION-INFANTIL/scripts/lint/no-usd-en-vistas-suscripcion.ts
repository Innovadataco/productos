/**
 * SPEC-289 (002-PI-189 · Fase 1) · Ratchet — `no-usd-en-vistas-suscripcion`.
 *
 * En las páginas de suscripción del cliente (`/dashboard/{colegio,padre}/suscripcion/**`)
 * NO puede aparecer un ACCESO a `precioBaseUSD` (`plan.precioBaseUSD`,
 * `.precioBaseUSD` sobre cualquier expresión) NI un binding contra ese campo.
 * El objetivo es que la UI del cliente colombiano no lea el precio USD.
 *
 * El ratchet usa parseo AST (typescript compilerAPI) para distinguir:
 *  - USO (bloqueado): `plan.precioBaseUSD`, `x.precioBaseUSD`, patrón destructor
 *    `{ precioBaseUSD } = plan`.
 *  - MENCIÓN INOFENSIVA (permitida): `precioBaseUSD: 0` como KEY de un
 *    ObjectLiteralExpression (necesaria para satisfacer `PlanSelectorDTO` hasta
 *    que Fase 2 lo elimine), comentarios, strings.
 *
 * Exit codes: 0 = verde, 1 = ocurrencias, 2 = error I/O/parseo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

export interface UsoHit {
    file: string;
    line: number;
    text: string;
}

function caminar(dir: string, matcher: (name: string) => boolean, out: string[] = []): string[] {
    let entries: string[];
    try {
        entries = readdirSync(dir);
    } catch {
        return out;
    }
    for (const entry of entries) {
        if (entry === "node_modules" || entry === ".next") continue;
        const full = join(dir, entry);
        const s = statSync(full);
        if (s.isDirectory()) caminar(full, matcher, out);
        else if (matcher(entry)) out.push(full);
    }
    return out;
}

/**
 * Extrae ocurrencias de ACCESO a `precioBaseUSD` en TS/TSX. Ignora keys de
 * objetos literales (`precioBaseUSD: 0`) por diseño.
 */
export function buscarUsosPrecioUSD(dashboardSuscripcionDirs: string[]): UsoHit[] {
    const archivos: string[] = [];
    for (const d of dashboardSuscripcionDirs) {
        caminar(d, (n) => n.endsWith(".ts") || n.endsWith(".tsx"), archivos);
    }

    const hits: UsoHit[] = [];

    for (const file of archivos) {
        const texto = readFileSync(file, "utf8");
        const src = ts.createSourceFile(file, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

        function visitar(node: ts.Node) {
            // Caso 1: `x.precioBaseUSD` — acceso a propiedad.
            if (
                ts.isPropertyAccessExpression(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === "precioBaseUSD"
            ) {
                const pos = src.getLineAndCharacterOfPosition(node.getStart(src));
                hits.push({
                    file: relative(process.cwd(), file),
                    line: pos.line + 1,
                    text: node.getText(src).slice(0, 60),
                });
            }
            // Caso 2: patrón destructor `const { precioBaseUSD } = ...`
            if (
                ts.isBindingElement(node) &&
                ts.isIdentifier(node.name) &&
                node.name.text === "precioBaseUSD"
            ) {
                const pos = src.getLineAndCharacterOfPosition(node.getStart(src));
                hits.push({
                    file: relative(process.cwd(), file),
                    line: pos.line + 1,
                    text: "destructor { precioBaseUSD }",
                });
            }
            // NO se cuenta `PropertyAssignment` (clave de objeto literal) — es la
            // única mención permitida.
            ts.forEachChild(node, visitar);
        }

        visitar(src);
    }

    return hits;
}

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("no-usd-en-vistas-suscripcion.ts") ||
        process.argv[1].endsWith("no-usd-en-vistas-suscripcion.js"));

if (esEntry) {
    try {
        const dirs = [
            join(process.cwd(), "src", "app", "dashboard", "colegio", "suscripcion"),
            join(process.cwd(), "src", "app", "dashboard", "padre", "suscripcion"),
        ];
        const hits = buscarUsosPrecioUSD(dirs);
        if (hits.length > 0) {
            for (const h of hits) {
                console.error(`[LINT no-usd-en-vistas-suscripcion] ${h.file}:${h.line}  ${h.text}`);
            }
            console.error(
                `[LINT no-usd-en-vistas-suscripcion] FALLO — ${hits.length} accesos a precioBaseUSD en vistas de suscripción. ` +
                    "El cliente colombiano NO lee el precio USD (SPEC-289 · D-88).",
            );
            process.exit(1);
        }
        console.log("[LINT no-usd-en-vistas-suscripcion] OK — cero accesos a precioBaseUSD en vistas de suscripción");
    } catch (error) {
        console.error(`[LINT no-usd-en-vistas-suscripcion] Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
    }
}
