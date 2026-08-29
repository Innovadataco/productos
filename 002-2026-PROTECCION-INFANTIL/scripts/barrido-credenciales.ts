/**
 * Barrido de credenciales literales del repo (spec 105-US2, regla I-22).
 * Recorre el árbol buscando asignaciones de string literal a identificadores con pinta de
 * credencial. Reporta archivo:línea + tipo + clasificación (real vs placeholder) y NUNCA
 * imprime el valor encontrado. Exit 1 si hay hallazgos clasificados como "real".
 * Uso: npx tsx scripts/barrido-credenciales.ts
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const EXCLUDE_DIRS = new Set(["node_modules", ".next", ".git", ".venv-presidio", ".specify", "dist", "coverage"]);
const EXTENSIONES = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".yml", ".yaml", ".sh", ".env", ".sql", ".prisma", ".html"]);
const MAX_BYTES = 1024 * 1024;

const PATRON_CREDENCIAL = /(password|passwd|pwd|secret|token|api[-_]?key|encryption[-_]?key|private[-_]?key|salt)\s*[:=]\s*["'`]([^"'`\n]{8,})["'`]/i;
const PATRON_PLACEHOLDER = /^(change-me|changeme|build-placeholder|placeholder|example|dummy|test|cambiar|xxx+|<|\$\{|\$\(|process\.env|tu[-_]|your[-_])/i;

interface Hallazgo {
    archivo: string;
    linea: number;
    tipo: string;
    clase: "real" | "placeholder";
}

function* caminar(dir: string): Generator<string> {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith(".") && entry.name !== ".env.example" && entry.name !== ".env.production.example" && entry.name !== ".env.test") {
            continue;
        }
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (!EXCLUDE_DIRS.has(entry.name)) yield* caminar(full);
        } else if (EXTENSIONES.has(path.extname(entry.name))) {
            yield full;
        }
    }
}

function clasificar(rel: string, valor: string): "real" | "placeholder" {
    if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(rel)) return "placeholder"; // fixtures de pruebas (valores dummy)
    if (rel.endsWith("test-setup.ts") || rel.endsWith("test-utils.ts")) return "placeholder"; // setup de tests
    if (PATRON_PLACEHOLDER.test(valor)) return "placeholder";
    if (valor.length <= 12 && !/[A-Z]/.test(valor)) return "placeholder"; // evidentemente ficticia
    if (/^(admin|admin123|password|123456|qwerty)/i.test(valor)) return "placeholder"; // ejemplo burdo, no credencial viva
    if (rel.endsWith(".example") || rel.includes("__fixtures__")) return "placeholder";
    return "real";
}

function main() {
    const hallazgos: Hallazgo[] = [];
    for (const archivo of caminar(ROOT)) {
        const rel = path.relative(ROOT, archivo);
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
            if (m) {
                hallazgos.push({
                    archivo: rel,
                    linea: i + 1,
                    tipo: m[1].toLowerCase(),
                    clase: clasificar(rel, m[2].trim()),
                });
            }
        }
    }

    const reales = hallazgos.filter((h) => h.clase === "real");
    const placeholders = hallazgos.filter((h) => h.clase === "placeholder");

    console.log(`[BARRIDO] ${hallazgos.length} posibles credenciales literales: ${reales.length} real(es), ${placeholders.length} placeholder(s).`);
    for (const h of reales) {
        console.log(`  REAL        ${h.archivo}:${h.linea}  tipo=${h.tipo}`);
    }
    for (const h of placeholders) {
        console.log(`  placeholder ${h.archivo}:${h.linea}  tipo=${h.tipo}`);
    }
    if (reales.length > 0) {
        console.error("[BARRIDO] HAY CREDENCIALES LITERALES CLASIFICADAS COMO REALES. Revisar y rotar.");
        process.exit(1);
    }
    console.log("[BARRIDO] Sin credenciales literales reales en el repo.");
}

main();
