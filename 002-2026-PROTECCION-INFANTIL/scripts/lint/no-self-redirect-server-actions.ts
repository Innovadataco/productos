/**
 * SPEC-287 (002-PI-187) · Ratchet 3 — `no-self-redirect-server-actions`.
 *
 * Para cada `page.tsx` bajo `src/app/dashboard/**`, ninguna función marcada
 * `"use server"` puede contener `redirect(<ruta derivada del filesystem>)`.
 * El self-redirect en Server Action fue la segunda pieza del bucle I-141
 * (POST-redirect-GET al mismo path → re-evalúa el guardián). Se usa
 * `revalidatePath` en su lugar.
 *
 * Detecta por AST: encuentra funciones cuyo primer statement es la directiva
 * `"use server"`, luego busca `CallExpression` `redirect(<string literal>)`
 * cuya string coincida con la ruta URL derivada del path del archivo.
 *
 * Exit codes: 0 = verde, 1 = ocurrencias, 2 = error I/O/parseo.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, dirname, sep } from "node:path";
import * as ts from "typescript";

export interface Hit {
    file: string;
    line: number;
    rutaEsperada: string;
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

/**
 * Deriva la URL de una page.tsx del filesystem:
 *   src/app/dashboard/padre/suscripcion/page.tsx → /dashboard/padre/suscripcion
 * Ignora grupos `(marker)` y rutas dinámicas `[...]` en el prefijo (no aplican
 * al patrón self-redirect literal que buscamos).
 */
export function rutaDePagina(pagePath: string, appRoot: string): string {
    const rel = relative(appRoot, dirname(pagePath));
    if (!rel || rel === "." || rel === "") return "/";
    const segmentos = rel.split(sep).filter((s) => !s.startsWith("(") || !s.endsWith(")"));
    return "/" + segmentos.join("/");
}

/**
 * Verifica si una función lleva la directiva `"use server"` como primer
 * statement de su cuerpo.
 */
function tieneUseServer(fn: ts.FunctionLikeDeclarationBase): boolean {
    if (!fn.body || !ts.isBlock(fn.body)) return false;
    const first = fn.body.statements[0];
    if (!first || !ts.isExpressionStatement(first)) return false;
    const expr = first.expression;
    return ts.isStringLiteral(expr) && expr.text === "use server";
}

export function buscarSelfRedirects(appDir: string, dashboardDir: string): Hit[] {
    const pages = caminar(dashboardDir, (n) => n === "page.tsx");
    const hits: Hit[] = [];

    for (const file of pages) {
        const rutaEsperada = rutaDePagina(file, appDir);
        const texto = readFileSync(file, "utf8");
        const src = ts.createSourceFile(file, texto, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

        function visitar(node: ts.Node) {
            const esFn =
                ts.isFunctionDeclaration(node) ||
                ts.isFunctionExpression(node) ||
                ts.isArrowFunction(node) ||
                ts.isMethodDeclaration(node);
            if (esFn && tieneUseServer(node)) {
                // Dentro de esta función, buscar redirect("<rutaEsperada>")
                function visitarInterno(n: ts.Node) {
                    if (
                        ts.isCallExpression(n) &&
                        ts.isIdentifier(n.expression) &&
                        n.expression.text === "redirect" &&
                        n.arguments.length === 1 &&
                        ts.isStringLiteral(n.arguments[0]) &&
                        n.arguments[0].text === rutaEsperada
                    ) {
                        const pos = src.getLineAndCharacterOfPosition(n.getStart(src));
                        hits.push({
                            file: relative(process.cwd(), file),
                            line: pos.line + 1,
                            rutaEsperada,
                        });
                    }
                    ts.forEachChild(n, visitarInterno);
                }
                if (node.body) visitarInterno(node.body);
            }
            ts.forEachChild(node, visitar);
        }

        visitar(src);
    }

    return hits;
}

const esEntry =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("no-self-redirect-server-actions.ts") ||
        process.argv[1].endsWith("no-self-redirect-server-actions.js"));

if (esEntry) {
    try {
        const appDir = join(process.cwd(), "src", "app");
        const dashboardDir = join(appDir, "dashboard");
        const hits = buscarSelfRedirects(appDir, dashboardDir);
        if (hits.length > 0) {
            for (const h of hits) {
                console.error(`[LINT no-self-redirect-server-actions] ${h.file}:${h.line}  redirect("${h.rutaEsperada}")`);
            }
            console.error(
                `[LINT no-self-redirect-server-actions] FALLO — ${hits.length} Server Actions con self-redirect. ` +
                    "Usa revalidatePath() en su lugar (I-141).",
            );
            process.exit(1);
        }
        console.log("[LINT no-self-redirect-server-actions] OK — cero self-redirects en actions bajo /dashboard/**");
    } catch (error) {
        console.error(`[LINT no-self-redirect-server-actions] Error: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(2);
    }
}
