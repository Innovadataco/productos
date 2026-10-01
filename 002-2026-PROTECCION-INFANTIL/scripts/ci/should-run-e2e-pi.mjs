/**
 * SPEC-789 · Decisión de si la suite e2e (`test-e2e`) DEBE correr en un PR.
 *
 * Motivo (la cola dejó de drenar): `test-e2e` cuesta ~19 min en CADA PR y su
 * señal NO informa la decisión de mergear. El paso de la suite es
 * `continue-on-error`, así que no puede reportar el fallo de la suite; el número
 * OFICIAL de specs rojas sale de `main` (SPEC-774: `main` se verifica en cada
 * merge). La ÚNICA señal dura del job en un PR es la rotura del ARNÉS de siembra
 * (esquema/seed/pgboss). Correrlo en un PR que no toca nada de eso es gasto puro.
 *
 * Por eso, en `pull_request`, la suite corre SI Y SOLO SI algún archivo cambiado
 * puede romper el arnés — esquema, siembra o la propia suite. En push a `main`
 * (y `workflow_dispatch`) corre SIEMPRE, sin esta condición: ahí está la señal
 * integrada que queremos, y de ahí sale el número. Esa parte vive en el `if:` del
 * job (`github.event_name`), no acá.
 *
 * NO se usa `on: paths:` (candado I-249, mismo que should-skip-pi.mjs): un `paths:`
 * que no dispara deja el check REQUERIDO en *pendiente* para siempre y bloquea los
 * merges de otros productos. El patrón correcto es este: el job igual se dispara,
 * decide por su cuenta, y una conclusión `skipped` GitHub la trata como éxito.
 *
 * Dirección conservadora: ante la duda, CORRER. Un falso negativo (saltar un PR que
 * sí rompía el arnés) dejaría pudrir la siembra sin verse hasta el merge; un falso
 * positivo solo gasta 19 min. Por eso `prisma/` entra entero (esquema + seed.ts) y
 * la lista de prefijos abarca todo insumo del arnés que el job ejecuta.
 *
 * MISMA fuente de archivos que should-skip-pi.mjs (el `files_changed` del step
 * `should-skip`): una sola verdad de "qué cambió", con la misma fidelidad.
 */

const CARPETA_PI = "002-2026-PROTECCION-INFANTIL/";

// Prefijos (relativos a la carpeta de PI) donde un cambio puede romper el ARNÉS
// de la suite e2e. Cada uno mapea a un paso real del job `test-e2e` en ci.yml.
const PREFIJOS_ARNES = [
    // ESQUEMA: schema.prisma + migrations/ (el drift de 4 columnas que estrenó el
    // job, SPEC-775) y seed.ts viven bajo prisma/. Un cambio acá es la causa #1 de
    // rotura del arnés.
    "prisma/",
    // SUITE: los specs Playwright y su globalSetup (guardia SPEC-770 que aborta si la
    // BD no termina en `_test`).
    "tests/e2e/",
    // SIEMBRA e2e: sembradores específicos que el job corre (cuentas de rol,
    // multi-tenant, credenciales…). Prefijo cubre todos los `seed-e2e-*`.
    "scripts/seed-e2e-",
    // ARNÉS: inicializa las tablas `pgboss.*` en la BD fresca; sin esto el arnés
    // truena con 42P01 en todo flujo async.
    "scripts/ensure-pgboss",
    // SUITE (config): retries/globalSetup/webServer gobiernan CÓMO corre la suite.
    "playwright.config",
    // SIEMBRA (insumo): credenciales/vars E2E que consumen los sembradores en CI.
    ".env.test",
];

/** true si el archivo, tomado solo, puede romper el arnés e2e → obliga a correr la suite. */
export function puedeRomperArnesE2E(path) {
    if (!path.startsWith(CARPETA_PI)) return false;
    const dentro = path.slice(CARPETA_PI.length);
    return PREFIJOS_ARNES.some((prefijo) => dentro.startsWith(prefijo));
}

/** true si ALGÚN archivo cambiado puede romper el arnés → la suite DEBE correr en el PR. */
export function deberCorrerE2E(files) {
    return files.some(puedeRomperArnesE2E);
}

// --- CLI ------------------------------------------------------------
// Uso: `git diff --name-only HEAD^ HEAD | node scripts/ci/should-run-e2e-pi.mjs`
// Imprime "true" (correr) o "false" (saltar) en stdout — pensado para
//   e2e=$(echo "$files" | node scripts/ci/should-run-e2e-pi.mjs)
// dentro del step `should-skip` de `.github/workflows/ci.yml`.
async function main() {
    let stdin = "";
    for await (const chunk of process.stdin) stdin += chunk;
    const files = stdin.split("\n").map((l) => l.trim()).filter(Boolean);
    process.stdout.write(deberCorrerE2E(files) ? "true" : "false");
}

// Ejecutar solo cuando se invoca como binario (no cuando se importa desde el test).
const invocadoDirecto = process.argv[1] && process.argv[1].endsWith("should-run-e2e-pi.mjs");
if (invocadoDirecto) main();
