/**
 * SPEC-107 (cola 025, B3-b): guarda anti-literal a TODO el repo (amplía la guarda del seed
 * de la SPEC-105, que solo miraba el bloque del admin). Falla si aparece una asignación de
 * string literal con pinta de credencial (password/secret/token/key/salt) en cualquier
 * archivo fuera de la lista de exclusión.
 *
 * EXCLUSIONES explícitas (fixtures y plantillas — SOLO puede encoger en falsos positivos
 * justificados y documentados en el diff):
 * - archivos *.test.* / *.spec.* (fixtures de pruebas con valores dummy)
 * - setup/utils de tests (src/lib/test-setup.ts, src/lib/reporte-test-utils.ts, tests/)
 * - plantillas .env*example (placeholders change-me)
 * - este test y el barrido CLI (contienen los patrones, no credenciales)
 * - scripts/verify-encryption.ts (valor de verificación dummy documentado)
 * Placeholders de contenido (change-me, build-placeholder, $(...), process.env, ejemplos
 * burdos tipo "admin123") se ignoran en cualquier archivo.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".venv-presidio", "dist", "coverage"]);
const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".sh", ".sql", ".prisma"]);
const MAX_BYTES = 1024 * 1024;

const RUTAS_EXCLUIDAS = [
    /\/(test|tests|__tests__)\//,
    /\.(test|spec)\.(ts|tsx|js|mjs)$/,
    /test-setup\.ts$/,
    /reporte-test-utils\.ts$/,
    /\.env(\..*)?\.example$/,
    /credenciales-literal\.test\.ts$/,
    /barrido-credenciales\.ts$/,
    /verify-encryption\.ts$/,
];

const PATRON_CREDENCIAL = /(password|passwd|pwd|secret|token|api[-_]?key|encryption[-_]?key|private[-_]?key|salt)\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/i;
const PATRON_PLACEHOLDER = /^(change-me|changeme|build-placeholder|placeholder|example|dummy|test|cambiar|xxx+|<|\$\{|\$\(|process\.env|tu[-_]|your[-_]|admin123|password|123456|qwerty)/i;

function* caminar(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!EXCLUDE_DIRS.has(entry.name)) yield* caminar(full);
        } else if (EXTENSIONES.has(path.extname(entry.name))) {
            yield full;
        }
    }
}

describe("guarda anti-literal del repo (SPEC-107)", () => {
    it("ningún archivo fuera de las exclusiones asigna una credencial literal", () => {
        const violaciones: string[] = [];
        for (const archivo of caminar(ROOT)) {
            const rel = path.relative(ROOT, archivo).replace(/\\/g, "/");
            if (RUTAS_EXCLUIDAS.some((r) => r.test(rel))) continue;
            const stat = fs.statSync(archivo);
            if (stat.size > MAX_BYTES) continue;
            let contenido: string;
            try {
                contenido = fs.readFileSync(archivo, "utf-8");
            } catch {
                continue;
            }
            const lineas = contenido.split("\n");
            for (let i = 0; i < lineas.length; i++) {
                const m = lineas[i].match(PATRON_CREDENCIAL);
                if (m && !PATRON_PLACEHOLDER.test(m[2].trim())) {
                    violaciones.push(`${rel}:${i + 1} (tipo=${m[1].toLowerCase()})`);
                }
            }
        }
        expect(violaciones, violaciones.join("; ")).toEqual([]);
    });
});
