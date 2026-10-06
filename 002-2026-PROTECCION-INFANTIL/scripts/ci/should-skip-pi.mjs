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
 *   NNN-YYYY-… (006-BI, 007-PIWEB)                   → productos hermanos
 *   .github/workflows/{ci,verificar-base-pr}.yml     → workflows compartidos
 *   .github/workflows/bi*.yml                        → CI propio de BI (Kimi)
 *   AGENTS.md, README.md, .gitignore                 → docs raíz
 *
 * La suite corre SI Y SOLO SI algún archivo cambiado:
 *   (a) vive bajo `002-2026-PROTECCION-INFANTIL/` y NO es doc-only (docs/ o *.md), o
 *   (b) vive bajo `002-2026-PROTECCION-INFANTIL/specs/` (SPEC-865 P2, ver abajo), o
 *   (c) es uno de los workflows compartidos que también podrían afectar a PI.
 *
 * SPEC-865 P2 — specs/ SÍ corre la suite (antes era doc-only). El gate de higiene
 * de notas (`src/lib/specs-discipline.test.ts`, job `test-unit`) valida número único,
 * carpeta representable y Status canónico. Si un PR que SOLO toca `specs/` saltara la
 * suite, esa violación quedaría LATENTE hasta el primer PR de código (fue el workaround
 * de SPEC-861/866: quitar las notas opcionales en cada PR). Corriendo la suite en los
 * PRs de specs, la disciplina se valida ANTES del merge. El costo (la suite completa
 * sobre un PR de solo-notas) es de PI y no bloquea a otros productos.
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
        const dentro = path.slice(CARPETA_PI.length);
        // SPEC-865 P2: specs/ SÍ dispara la suite — el gate de disciplina de notas
        // (specs-discipline.test.ts, en test-unit) debe correr ANTES del merge. Va PRIMERO,
        // antes del descarte de *.md: una nota es `.md` y si no, el catch-all de abajo la
        // volvería a saltar. (docs/ sigue siendo doc-only; no tiene gate propio.)
        if (dentro.startsWith("specs/")) return true;
        // Doc-only dentro de PI (docs/ o cualquier *.md como README): no toca código ni
        // tiene un gate que validar, la suite no tiene qué hacer.
        if (dentro.startsWith("docs/")) return false;
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
