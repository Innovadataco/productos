/**
 * SPEC-374 · Decisión de si la suite de CI de PI DEBE correr.
 *
 * Motivo: los PRs de otros productos del monorepo (BI, PIWEB, SICOV…) esperaban
 * 25-30 minutos por los 4 shards de `test-integration` de PI aunque no tocaran
 * una línea nuestra. El propio job `should-skip` ya reportaba "skipped" para
 * commits doc-only; acá extendemos su regla a "no toca PI".
 *
 * NO se usa `on: paths:` (candado I-249): un `paths:` que no dispara el
 * workflow deja los checks REQUERIDOS de PI en estado *pendiente* → bloquea
 * los merges de BI para siempre. El patrón correcto es este: el job igual se
 * dispara, decide por su cuenta si saltar, y una conclusión `skipped` GitHub
 * la trata como éxito para required checks.
 *
 * Convivencia en el monorepo:
 *   NNN-YYYY-… (000-…, 004-…, 006-…, 007-PIWEB, …)  → productos hermanos
 *   .github/workflows/{ci,verificar-base-pr}.yml     → workflows compartidos
 *   .github/workflows/bi*.yml                        → CI propio de BI (Kimi)
 *   AGENTS.md, README.md, .gitignore                 → docs raíz
 *
 * La suite corre SI Y SOLO SI algún archivo cambiado:
 *   (a) vive bajo `002-2026-PROTECCION-INFANTIL/` y NO es doc-only (docs/, specs/, *.md), o
 *   (b) es uno de los workflows compartidos que también podrían afectar a PI.
 *
 * Cambios en `.gitignore` raíz, AGENTS.md, README.md, workflows de otros
 * productos, o cualquier `NNN-YYYY-…` fuera de PI **no** disparan la suite.
 * Si un cambio raíz suelto realmente afectara a PI, se detectaría por reflejo
 * en algún archivo de `002-2026-PROTECCION-INFANTIL/`.
 */

const CARPETA_PI = "002-2026-PROTECCION-INFANTIL/";
const WORKFLOWS_COMPARTIDOS = new Set([
    ".github/workflows/ci.yml",
    ".github/workflows/verificar-base-pr.yml",
]);

/** true si el archivo, tomado solo, ya obliga a correr la suite de PI. */
export function afectaAPI(path) {
    if (path.startsWith(CARPETA_PI)) {
        // Doc-only dentro de PI (docs/, specs/, o cualquier *.md como README):
        // no toca código, la suite no tiene qué validar.
        const dentro = path.slice(CARPETA_PI.length);
        if (dentro.startsWith("docs/") || dentro.startsWith("specs/")) return false;
        if (path.endsWith(".md")) return false;
        return true;
    }
    // Fuera de PI, solo los workflows compartidos disparan la suite.
    // `bi.yml`, `bi-006.yml` y otros son ajenos.
    return WORKFLOWS_COMPARTIDOS.has(path);
}

/** true si NINGÚN archivo cambiado obliga a correr la suite. */
export function deberSaltar(files) {
    return !files.some(afectaAPI);
}

// --- CLI ------------------------------------------------------------
// Uso: `git diff --name-only HEAD^ HEAD | node scripts/ci/should-skip-pi.mjs`
// Imprime "true" o "false" en stdout — pensado para
//   skip=$(echo "$files" | node scripts/ci/should-skip-pi.mjs)
// dentro del step `should-skip` de `.github/workflows/ci.yml`.
async function main() {
    let stdin = "";
    for await (const chunk of process.stdin) stdin += chunk;
    const files = stdin.split("\n").map((l) => l.trim()).filter(Boolean);
    process.stdout.write(deberSaltar(files) ? "true" : "false");
}

// Ejecutar solo cuando se invoca como binario (no cuando se importa desde el test).
const invocadoDirecto = process.argv[1] && process.argv[1].endsWith("should-skip-pi.mjs");
if (invocadoDirecto) main();
