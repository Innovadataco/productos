/**
 * SPEC-287 (002-PI-187) · Ratchet 2 — `no-redirect-en-layout-de-dashboard`.
 *
 * Ningún `src/app/dashboard/**\/layout.tsx` puede contener llamada a `redirect(...)`.
 * Los layouts renderizan; el middleware redirige. Es la única forma de romper
 * la cadena I-25 → I-111 → I-141 (guardián en layout → misma ruta → bucle).
 *
 * Detecta por parseo AST (typescript compilerAPI) — no matchea comentarios ni
 * strings. Solo `CallExpression` cuyo callee es `Identifier("redirect")`.
 *
 * Exit codes: 0 = verde, 1 = ocurrencias, 2 = error I/O/parseo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import * as ts from "typescript";

export interface RedirectHit {
    file: string;
    line: number;
    text: string;
}

function caminar(dir: string, matcher: (name: string) => boolean, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next") continue;
        const full = join(dir, entry);
        const s = statSync(full);
        if (s.isDirectory()) caminar(full, matcher, out);
        else if (matcher(entry)) out.push(full);
    }
    return out;
}

export function buscarRedirectsEnLayouts(dashboardDir: string): RedirectHit[] {
    const layouts = caminar(dashboardDir, (n) => n === "layout.tsx");
    const hits: RedirectHit[] = [];

    for (const file of layouts) {
        const texto = readFileSync(file, "utf8");
        const src = ts.createSourceFile(file, texto, ts.ScriptTarget.Latest, /*setParentNodes*/ true, ts.ScriptKind.TSX);

        function visitar(node: ts.Node) {
            if (
                ts.isCallExpression(node) &&
                ts.isIdentifier(node.expression) &&
                node.expression.text === "redirect"
            ) {
                const pos = src.getLineAndCharacterOfPosition(node.getStart(src));
                hits.push({
                    file: relative(process.cwd(), file),
                    line: pos.line + 1,
                    text: node.getText(src).slice(0, 80),
                });
            }
            ts.forEachChild(node, visitar);
        }

        visitar(src);
    }

    return hits;
}

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("no-redirect-en-layout-de-dashboard.ts") ||
        process.argv[1].endsWith("no-redirect-en-layout-de-dashboard.js"));

if (esEntry) {
    try {
        const hits = buscarRedirectsEnLayouts(join(process.cwd(), "src", "app", "dashboard"));
        if (hits.length > 0) {
            for (const h of hits) {
                console.error(`[LINT no-redirect-en-layout-de-dashboard] ${h.file}:${h.line}  ${h.text}`);
            }
            console.error(
                `[LINT no-redirect-en-layout-de-dashboard] FALLO — ${hits.length} llamadas a redirect(...) en layouts. ` +
                    "Los layouts NO redirigen (I-25/I-111/I-141). Mueve el guardián a middleware.ts.",
            );
            process.exit(1);
        }
        console.log("[LINT no-redirect-en-layout-de-dashboard] OK — cero redirects en layouts dashboard");
    } catch (error) {
        console.error(`[LINT no-redirect-en-layout-de-dashboard] Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
    }
}
