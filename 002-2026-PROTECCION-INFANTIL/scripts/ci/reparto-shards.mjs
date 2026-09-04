#!/usr/bin/env node
/**
 * SPEC-281 (002-PI-180): reparto por peso de los shards de test-integration.
 *
 * Uso:
 *   node scripts/ci/reparto-shards.mjs --shard=N/4 --durations test-durations.json
 *
 * Salida: los archivos que le corresponden al shard N (uno por línea, para $(...) en shell).
 *
 * Comportamiento ante ausencia/corrupción de test-durations.json: cae al fallback
 * de --shard=N/4 puro imprimiendo NADA en stdout (el shell queda con un $() vacío
 * y vitest aplica su reparto original). Sale con exit 0 (no rompe CI el primer día).
 *
 * Algoritmo: LPT greedy (Longest Processing Time first).
 */
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve } from "node:path";

/**
 * SPEC-450 · cuántas corridas hacen falta para que un peso deje de ser
 * provisional. Con una sola corrida el número es una foto: el 03-09 se armó el
 * archivo entero con `corridas: 1` y la deriva no avisó hasta que un shard tocó
 * el techo de 45 min.
 */
const MUESTRAS_PARA_CONFIAR = 3;

function parseArgs(argv) {
    const args = {};
    for (const a of argv) {
        if (a.startsWith("--shard=")) args.shard = a.slice("--shard=".length);
        else if (a.startsWith("--durations=")) args.durations = a.slice("--durations=".length);
        else if (a === "--shard" || a === "--durations") continue;
    }
    // También formato con espacio: --shard N/4 --durations path
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--shard" && argv[i + 1]) args.shard = argv[i + 1];
        else if (argv[i] === "--durations" && argv[i + 1]) args.durations = argv[i + 1];
    }
    return args;
}

function parseShardArg(raw) {
    const m = /^(\d+)\/(\d+)$/.exec(raw ?? "");
    if (!m) throw new Error(`--shard debe ser N/M (ej: 1/4). Recibido: ${raw}`);
    const n = Number(m[1]);
    const total = Number(m[2]);
    if (n < 1 || n > total) throw new Error(`--shard fuera de rango: ${raw}`);
    return { n, total };
}

/**
 * Reparto LPT greedy: ordena descendente por duración, y asigna cada archivo
 * al shard actualmente más liviano. Determinista (empates por índice original).
 */
export function repartirEnShards(archivosConDuracion, numShards) {
    const shards = Array.from({ length: numShards }, () => ({ archivos: [], totalMs: 0 }));
    const ordenados = [...archivosConDuracion].sort((a, b) => {
        if (b.duracionMs !== a.duracionMs) return b.duracionMs - a.duracionMs;
        return a.archivo.localeCompare(b.archivo);
    });
    for (const item of ordenados) {
        let idxMin = 0;
        for (let i = 1; i < shards.length; i++) {
            if (shards[i].totalMs < shards[idxMin].totalMs) idxMin = i;
        }
        shards[idxMin].archivos.push(item.archivo);
        shards[idxMin].totalMs += item.duracionMs;
    }
    // Orden interno alfabético dentro de cada shard (determinista y compacto).
    for (const s of shards) s.archivos.sort();
    return shards;
}

/**
 * Lista de archivos de prueba que corren en test-integration:
 * los que caen bajo el glob de vitest.config.ts (include) menos los excludes.
 * Usa `git ls-files` para no depender de globs externos.
 */
function listarArchivosDeIntegration(repoRoot) {
    const raw = execSync("git ls-files 'src/**/*.test.ts' 'src/**/*.test.tsx'", {
        cwd: repoRoot,
        encoding: "utf-8",
        maxBuffer: 32 * 1024 * 1024,
    });
    const todos = raw.split("\n").filter(Boolean);
    // Cargar UNIT_TEST_INCLUDES desde el archivo TS (parseo simple, sin ejecutar TS).
    // Formato conocido: cadenas entre comillas dobles, una por línea.
    const unitTs = readFileSync(resolve(repoRoot, "vitest.unit.includes.ts"), "utf-8");
    const unitIncludes = new Set(
        [...unitTs.matchAll(/"([^"]+\.test\.(ts|tsx|mjs))"/g)].map((m) => m[1])
    );
    // Excluye también los journeys (tienen su propio job).
    return todos.filter((f) =>
        !unitIncludes.has(f)
        && !f.startsWith("src/lib/e2e/journeys/")
    );
}

function main() {
    const args = parseArgs(process.argv.slice(2));
    const { n, total } = parseShardArg(args.shard);
    const durationsPath = args.durations ?? "test-durations.json";
    const repoRoot = process.cwd();

    if (!existsSync(durationsPath)) {
        console.error(`[reparto-shards] ${durationsPath} no existe → fallback a --shard=${n}/${total} puro`);
        process.exit(0);
    }

    let map;
    try {
        map = JSON.parse(readFileSync(durationsPath, "utf-8"));
    } catch (err) {
        console.error(`[reparto-shards] ${durationsPath} corrupto (${err.message}) → fallback`);
        process.exit(0);
    }

    if (!map || typeof map !== "object" || Array.isArray(map)) {
        console.error(`[reparto-shards] ${durationsPath} no es un objeto → fallback`);
        process.exit(0);
    }

    // Ignora la clave especial de metadatos.
    const durMap = { ...map };
    delete durMap._meta;

    const archivos = listarArchivosDeIntegration(repoRoot);
    if (archivos.length === 0) {
        console.error("[reparto-shards] no encontré archivos de integration → fallback");
        process.exit(0);
    }

    // SPEC-450: el archivo de pesos admite DOS formas por entrada:
    //   · número suelto           → formato histórico de SPEC-281
    //   · { ms, muestras }        → formato nuevo, con cuántas corridas lo midieron
    // Leer las dos evita una migración de golpe y deja convivir lo viejo.
    const msDe = (v) => {
        if (typeof v === "number") return v > 0 ? v : null;
        if (v && typeof v === "object" && typeof v.ms === "number" && v.ms > 0) return v.ms;
        return null;
    };
    const muestrasDe = (v) => (v && typeof v === "object" && typeof v.muestras === "number" ? v.muestras : 1);

    // Mediana de las duraciones conocidas para archivos sin dato.
    const duracionesConocidas = Object.values(durMap)
        .map(msDe)
        .filter((v) => v !== null)
        .sort((a, b) => a - b);
    const mediana = duracionesConocidas.length > 0
        ? duracionesConocidas[Math.floor(duracionesConocidas.length / 2)]
        : 10000;

    // SPEC-450 · lo que antes entraba CALLADO ahora avisa.
    //
    // Un archivo sin medición se reparte con la mediana. Eso está bien como
    // arranque, pero es mentira para un archivo pesado: el máximo medido son
    // ~33 s contra una mediana de ~6 s, así que un test nuevo y caro se
    // subestima 5× y el shard que le toque se pasa de largo. Antes no lo decía
    // nadie; la deriva solo se veía como «un shard tardó el doble».
    const sinMedicion = archivos.filter((a) => msDe(durMap[a]) === null);
    const provisionales = archivos.filter((a) => {
        const v = durMap[a];
        return msDe(v) !== null && muestrasDe(v) < MUESTRAS_PARA_CONFIAR;
    });
    if (sinMedicion.length > 0) {
        console.error(
            `[reparto-shards] ::warning:: ${sinMedicion.length} archivo(s) SIN medición entran con la mediana ` +
            `(${Math.round(mediana / 1000)}s). Si alguno es pesado, su shard se pasa de largo.`
        );
        for (const a of sinMedicion.slice(0, 10)) console.error(`[reparto-shards]   · ${a}`);
        if (sinMedicion.length > 10) console.error(`[reparto-shards]   · … y ${sinMedicion.length - 10} más`);
    }
    if (provisionales.length > 0) {
        console.error(
            `[reparto-shards] ::warning:: ${provisionales.length} archivo(s) con MENOS de ${MUESTRAS_PARA_CONFIAR} ` +
            "corridas medidas: su peso todavía es provisional."
        );
    }

    const archivosConDuracion = archivos.map((archivo) => ({
        archivo,
        duracionMs: msDe(durMap[archivo]) ?? mediana,
    }));

    // SPEC-407 (CEO 22:2x): candado de cobertura. Si el archivo de pesos
    // cubre menos del 80% de los tests, el reparto trabaja "casi a ciegas"
    // (mediana bruta para el resto → LPT amontona los pesados donde caiga).
    // Es exactamente el estado en el que empezamos el 03-09-2026: 8 pesos
    // reales sobre ~478 archivos, reparto malo pero sin queja alguna. Este
    // warning cierra el ciclo: si dentro de tres meses el archivo se queda
    // viejo, se sabe apenas corre el shard.
    const conDatoReal = archivos.filter((a) => typeof durMap[a] === "number" && durMap[a] > 0).length;
    const cobertura = archivos.length > 0 ? conDatoReal / archivos.length : 0;
    const UMBRAL_COBERTURA = 0.80;
    if (cobertura < UMBRAL_COBERTURA) {
        const pct = (cobertura * 100).toFixed(1);
        console.error(`[reparto-shards] ⚠️  test-durations.json cubre ${conDatoReal}/${archivos.length} archivos (${pct}%) — bajo el umbral ${(UMBRAL_COBERTURA * 100).toFixed(0)}%. LPT usa mediana para el resto y amontona pesados. Regenerar con scripts/ci/actualizar-duraciones.mjs sobre una corrida verde.`);
        // GHA actions marcan el warning como anotación oficial del step:
        console.error(`::warning title=SPEC-407 cobertura de pesos::test-durations.json cubre solo ${pct}% de los tests (${conDatoReal}/${archivos.length}); regenerar con actualizar-duraciones.mjs`);
    }

    const shards = repartirEnShards(archivosConDuracion, total);

    // Candado SC-005 (no perder archivos): la suma de longitudes debe ser exacta.
    const totalRepartidos = shards.reduce((sum, s) => sum + s.archivos.length, 0);
    if (totalRepartidos !== archivos.length) {
        console.error(`[reparto-shards] ERROR: ${archivos.length} archivos, repartidos ${totalRepartidos}`);
        process.exit(1);
    }

    const miShard = shards[n - 1];
    // Log a stderr para no contaminar stdout (que va como positional args a vitest).
    console.error(`[reparto-shards] shard ${n}/${total}: ${miShard.archivos.length} archivos, peso estimado ${Math.round(miShard.totalMs / 1000)}s`);
    process.stdout.write(miShard.archivos.join(" "));
}

if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}
