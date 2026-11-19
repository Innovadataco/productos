/**
 * SPEC-930 · Afirma el CONTEO del reporte JSON de Playwright de los journeys de regresión, no solo el exit code.
 *
 * Por qué: la suite e2e NO cargaba en CI desde SPEC-817 (config con `import.meta` cargada como CJS) y el paso
 * blando quedaba «success». Un exit code no distingue «corrieron y pasaron» de «no corrió nada». Este verificador
 * exige, contra el árbol REAL de `tests/e2e/`:
 *   (a) hay ≥ 1 archivo `recorrido-journey-*.spec.ts` (0 journeys → ROJO: no es verde vacío);
 *   (b) el reporte existe y se puede leer (config rota / Playwright sin arrancar → sin reporte → ROJO);
 *   (c) los archivos que CORRIERON son EXACTAMENTE los journey del árbol (falta uno → ROJO);
 *   (d) cada archivo corrió ≥ 1 test, y TODOS terminaron `expected` o `flaky` (unexpected/skipped → ROJO).
 *
 * Puro + CLI, sin dependencias. Uso: node scripts/ci/verificar-journeys.mjs <reporte.json> [<dir tests/e2e>]
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const PREFIJO_JOURNEY = /^recorrido-journey-.*\.spec\.ts$/;

/** Archivos journey del árbol (basename). */
export function journeysDelArbol(dirE2e) {
    if (!existsSync(dirE2e)) return [];
    return readdirSync(dirE2e).filter((f) => PREFIJO_JOURNEY.test(f)).sort();
}

/** Aplana el reporte JSON de Playwright: [{ archivo, titulo, status }] por test. */
export function testsDelReporte(reporte) {
    const out = [];
    const visitar = (suite, archivo) => {
        const file = suite.file ?? archivo;
        for (const spec of suite.specs ?? []) {
            for (const t of spec.tests ?? []) {
                out.push({ archivo: basename(spec.file ?? file ?? ""), titulo: spec.title, status: t.status });
            }
        }
        for (const s of suite.suites ?? []) visitar(s, file);
    };
    for (const s of reporte?.suites ?? []) visitar(s, s.file);
    return out;
}

/**
 * @param {unknown} reporte  JSON del reporter `json` de Playwright (o null si no existe)
 * @param {string[]} archivos  journeys del árbol
 * @returns {{ ok: boolean, errores: string[], resumen: string }}
 */
export function verificarJourneys(reporte, archivos) {
    const errores = [];
    if (archivos.length === 0) errores.push("0 archivos recorrido-journey-*.spec.ts en tests/e2e: no hay journeys que correr.");
    if (!reporte) {
        errores.push("Sin reporte JSON de Playwright: la corrida no arrancó (¿config rota?).");
        return { ok: false, errores, resumen: "sin reporte" };
    }
    const tests = testsDelReporte(reporte);
    const porArchivo = new Map();
    for (const t of tests) porArchivo.set(t.archivo, [...(porArchivo.get(t.archivo) ?? []), t]);

    for (const f of archivos) {
        const ts = porArchivo.get(f) ?? [];
        if (ts.length === 0) errores.push(`${f}: 0 tests corridos.`);
    }
    for (const f of porArchivo.keys()) {
        if (!archivos.includes(f)) errores.push(`${f}: corrió pero no es un journey del árbol.`);
    }
    for (const t of tests) {
        if (t.status !== "expected" && t.status !== "flaky") errores.push(`${t.archivo} › ${t.titulo}: ${t.status}.`);
    }
    const pasados = tests.filter((t) => t.status === "expected" || t.status === "flaky").length;
    const resumen = `${archivos.length} journeys en el árbol · ${porArchivo.size} archivos corridos · ${tests.length} tests · ${pasados} ok · ${tests.length - pasados} no ok`;
    return { ok: errores.length === 0, errores, resumen };
}

const esCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (esCli) {
    const rutaReporte = process.argv[2] ?? "journeys-report.json";
    const dirE2e = process.argv[3] ?? resolve(dirname(fileURLToPath(import.meta.url)), "../../tests/e2e");
    let reporte = null;
    try {
        reporte = JSON.parse(readFileSync(rutaReporte, "utf-8"));
    } catch {
        reporte = null;
    }
    const r = verificarJourneys(reporte, journeysDelArbol(dirE2e));
    if (r.ok) {
        console.log(`✅ Journeys: ${r.resumen}`);
    } else {
        console.error(`❌ Journeys: ${r.resumen}`);
        for (const e of r.errores) console.error(`  ✗ ${e}`);
        process.exitCode = 1;
    }
}
