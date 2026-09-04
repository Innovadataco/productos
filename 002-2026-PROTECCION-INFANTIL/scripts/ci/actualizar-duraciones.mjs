#!/usr/bin/env node
/**
 * SPEC-281 (002-PI-180): actualiza test-durations.json con la media móvil
 * de la última corrida. Emite el JSON actualizado por stdout (para inspección)
 * y reescribe el archivo in-place.
 *
 * Uso:
 *   node scripts/ci/actualizar-duraciones.mjs \
 *     --vitest-json vitest-summary.json \
 *     --durations test-durations.json
 *
 * Estrategia:
 *   - nuevo = 0.4 * corrida + 0.6 * histórico (media móvil ponderada)
 *   - archivos sin histórico previo entran con el valor de esta corrida.
 *   - archivos borrados/renombrados (no aparecen en la corrida y llevan
 *     > 30 días sin verse) se eliminan.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIAS_INACTIVO_PARA_BORRAR = 30;

/**
 * SPEC-450 · cuántas corridas se guardan por archivo. Cinco alcanzan para que
 * la mediana ignore un runner lento aislado sin arrastrar historia vieja.
 */
const VENTANA_MUESTRAS = 5;

/** Historial previo de un archivo, tolerando el formato viejo (número suelto). */
function historiaDe(valor) {
    if (typeof valor === "number" && valor > 0) return [valor];
    if (valor && typeof valor === "object" && Array.isArray(valor.historia)) {
        return valor.historia.filter((n) => typeof n === "number" && n > 0);
    }
    if (valor && typeof valor === "object" && typeof valor.ms === "number" && valor.ms > 0) return [valor.ms];
    return [];
}

/** Mediana entera de una lista no vacía. */
function medianaDe(valores) {
    const v = [...valores].sort((a, b) => a - b);
    const m = Math.floor(v.length / 2);
    return v.length % 2 === 1 ? v[m] : Math.round((v[m - 1] + v[m]) / 2);
}

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--vitest-json" && argv[i + 1]) args.vitestJson = argv[++i];
        else if (argv[i] === "--durations" && argv[i + 1]) args.durations = argv[++i];
    }
    return args;
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.vitestJson || !args.durations) {
        console.error("[actualizar-duraciones] uso: --vitest-json <path> --durations <path>");
        process.exit(1);
    }
    if (!existsSync(args.vitestJson)) {
        console.error(`[actualizar-duraciones] ${args.vitestJson} no existe — skip`);
        process.exit(0);
    }
    const vitest = JSON.parse(readFileSync(args.vitestJson, "utf-8"));
    if (!Array.isArray(vitest.testResults)) {
        console.error("[actualizar-duraciones] JSON de vitest sin testResults — skip");
        process.exit(0);
    }
    const previo = existsSync(args.durations)
        ? JSON.parse(readFileSync(args.durations, "utf-8"))
        : {};
    const meta = previo._meta ?? { spec: "SPEC-281", corridas: 0 };
    const salida = {};
    const vistosEnEstaCorrida = new Set();

    for (const file of vitest.testResults) {
        if (!file.name) continue;
        const relPath = file.name.replace(/^.*?(002-2026-PROTECCION-INFANTIL\/)/, "");
        const totalMs = typeof file.endTime === "number" && typeof file.startTime === "number"
            ? file.endTime - file.startTime
            : null;
        if (!totalMs || totalMs <= 0) continue;
        vistosEnEstaCorrida.add(relPath);
        // SPEC-450 · MEDIANA de las últimas corridas, no media móvil de una.
        //
        // El archivo entero se armó el 03-09 con `corridas: 1`: una foto de un
        // runner puntual. Con la media móvil, un runner lento contaminaba el
        // peso para siempre y con el doble de su valor real. La mediana de una
        // ventana ignora ese pico sin necesidad de detectarlo, y `muestras` deja
        // ver de cuántas corridas sale cada número — el reparto avisa cuando
        // todavía son pocas.
        const historiaPrevia = historiaDe(previo[relPath]);
        const historia = [...historiaPrevia, Math.round(totalMs)].slice(-VENTANA_MUESTRAS);
        salida[relPath] = { ms: medianaDe(historia), muestras: historia.length, historia };
    }

    // Conserva archivos que no aparecieron en esta corrida pero que llevan poco
    // tiempo desperdigados (podrían ser un shard flaky). Solo borra los de > 30 días.
    const ahoraMs = new Date(meta.updatedAt ?? new Date().toISOString()).getTime();
    for (const [k, v] of Object.entries(previo)) {
        if (k === "_meta") continue;
        if (salida[k] !== undefined) continue;
        // No lo vimos esta corrida: consérvalo si no está muy viejo.
        const diasSinVerse = (Date.now() - ahoraMs) / (86400 * 1000);
        if (diasSinVerse < DIAS_INACTIVO_PARA_BORRAR) {
            salida[k] = v;
        } else {
            console.error(`[actualizar-duraciones] borrando archivo inactivo: ${k}`);
        }
    }

    const nuevo = {
        _meta: {
            ...meta,
            updatedAt: new Date().toISOString(),
            corridas: (meta.corridas ?? 0) + 1,
        },
        ...Object.fromEntries(Object.entries(salida).sort(([a], [b]) => a.localeCompare(b))),
    };

    writeFileSync(args.durations, JSON.stringify(nuevo, null, 4) + "\n");
    console.error(`[actualizar-duraciones] ${Object.keys(salida).length} archivos actualizados, corrida #${nuevo._meta.corridas}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
