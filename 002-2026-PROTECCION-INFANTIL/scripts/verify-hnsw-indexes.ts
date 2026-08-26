/**
 * SPEC-251 (002-PI-154) · Guardián de índices · cierra I-49.
 *
 * Extiende el verificador original (SPEC-145) de 2 a 5 índices y lo conecta a
 * las 3 compuertas (CI, deploy-prod.sh, pi-monitor). El guardián SOLO observa y
 * reporta — nunca crea, repara ni borra índices. Reparar es decisión humana.
 *
 * Uso:
 *   pnpm indices:check           → verificación humana (alias: pnpm db:verify:hnsw)
 *   pnpm indices:check --json    → resultado en JSON para consumo por máquina
 *
 * Exit codes:
 *   0 — todos los índices presentes con su tipo correcto (puede haber advertencias de huérfanos)
 *   1 — falta al menos un índice esperado o el tipo no coincide
 *   2 — error de infraestructura (BD no alcanzable, timeout)
 */
import { prisma } from "../src/lib/prisma";

// ────────────────────────────────────────────────────────────────────────────
// Lista declarada de índices esperados (fuente única de verdad del guardián).
// Agregar un índice nuevo por SQL crudo OBLIGA a declararlo aquí — esa es la
// disciplina que este frente quiere forzar.
//
// Tipos admitidos: 'btree' | 'gin' | 'hnsw' | 'unique'
//   - 'hnsw' : se verifica buscando "using hnsw" en indexdef
//   - 'gin'  : se verifica buscando "using gin" en indexdef
//   - 'btree': se verifica buscando "using btree" en indexdef (también implícito)
//   - 'unique': se verifica con pg_index.indisunique via join
// ────────────────────────────────────────────────────────────────────────────
export interface IndiceRequerido {
    name: string;
    table: string;
    type: "btree" | "gin" | "hnsw" | "unique";
    sostiene: string;
    migracion: string;
}

export const REQUIRED: IndiceRequerido[] = [
    {
        name: "Ciudad_nombreNormalizado_trgm_idx",
        table: "Ciudad",
        type: "gin",
        sostiene: "búsqueda de ciudades por trigram (I-45) — sin él, barrido secuencial",
        migracion: "20260729130000_catalogo_geografico_latam",
    },
    {
        name: "EmbeddingDataset_vector_idx",
        table: "EmbeddingDataset",
        type: "hnsw",
        sostiene: "deduplicación del motor IA (RAG) — sin él, escaneo completo de embeddings",
        migracion: "20260717002004_add_pgvector_hnsw_indexes",
    },
    {
        name: "EmbeddingReporte_vector_idx",
        table: "EmbeddingReporte",
        type: "hnsw",
        sostiene: "búsqueda vectorial de reportes similares (RAG) — sin él, el motor se degrada a escaneo",
        migracion: "20260717002004_add_pgvector_hnsw_indexes",
    },
    {
        name: "AlertaColegio_patronInstitucionalId_idx",
        table: "AlertaColegio",
        type: "btree",
        sostiene: "join entre alertas y patrones institucionales — sin él, barrido en AlertaColegio",
        migracion: "20260802170000_f5_evento_match_f6_patrones",
    },
    {
        // Nombre truncado a 63 caracteres por PostgreSQL. El nombre completo sería:
        // "patrones_institucionales_colegioId_periodo_grado_conducta_plataformaId_key" (74 chars).
        // NO renombrar este índice — es riesgoso y sin beneficio inmediato (brief §9 de SPEC-251).
        // Declarar siempre el nombre real que PostgreSQL guardó, no el ideal.
        name: "patrones_institucionales_colegioId_periodo_grado_conducta__key",
        table: "patrones_institucionales",
        type: "unique",
        sostiene: "unicidad de patrón institucional por (colegio, periodo, grado, conducta, plataforma)",
        migracion: "20260802170000_f5_evento_match_f6_patrones",
    },
];

// ────────────────────────────────────────────────────────────────────────────
// Tipos de resultado
// ────────────────────────────────────────────────────────────────────────────
export interface ResultadoVerificacion {
    ok: boolean;
    missing: string[];
    wrongType: { name: string; expected: string; found: string }[];
    orphans: string[];
    checkedAt: string;
    durationMs: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Verificación principal (exportada para uso in-process por pi-monitor)
// ────────────────────────────────────────────────────────────────────────────
interface FilaIndice {
    indexname: string;
    indexdef: string;
    isunique: boolean;
}

export async function verificarIndices(): Promise<ResultadoVerificacion> {
    const inicio = Date.now();

    // Una sola consulta a pg_indexes (sin JOIN a pg_index para máxima compatibilidad).
    // Para detectar UNIQUE se examina indexdef: PostgreSQL siempre emite
    // "CREATE UNIQUE INDEX ..." para los unique constraints — no depende de pg_index.
    const rows = await prisma.$queryRaw<FilaIndice[]>`
        SELECT
            indexname,
            indexdef,
            (indexdef ILIKE 'CREATE UNIQUE INDEX%') AS isunique
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname NOT LIKE 'pg_%'
    `;

    const byName = new Map<string, FilaIndice>(rows.map((r: FilaIndice) => [r.indexname, r]));
    const expectedNames = new Set(REQUIRED.map((r) => r.name));

    const missing: string[] = [];
    const wrongType: { name: string; expected: string; found: string }[] = [];

    for (const req of REQUIRED) {
        const row = byName.get(req.name);
        if (!row) {
            missing.push(req.name);
            continue;
        }
        const def = row.indexdef.toLowerCase();

        let tipoOk = false;
        let tipoEncontrado = "desconocido";

        if (req.type === "hnsw") {
            tipoOk = def.includes("using hnsw");
            if (!tipoOk) tipoEncontrado = def.match(/using (\w+)/)?.[1] ?? "desconocido";
        } else if (req.type === "gin") {
            tipoOk = def.includes("using gin");
            if (!tipoOk) tipoEncontrado = def.match(/using (\w+)/)?.[1] ?? "desconocido";
        } else if (req.type === "btree") {
            // btree es el método por defecto; puede aparecer explícito o ausente en indexdef.
            tipoOk = def.includes("using btree") || !def.includes("using ");
            if (!tipoOk) tipoEncontrado = def.match(/using (\w+)/)?.[1] ?? "desconocido";
        } else if (req.type === "unique") {
            // PostgreSQL emite "CREATE UNIQUE INDEX ..." para todos los unique constraints.
            tipoOk = Boolean(row.isunique);
            if (!tipoOk) tipoEncontrado = "no-unique";
        }

        if (!tipoOk) {
            wrongType.push({ name: req.name, expected: req.type, found: tipoEncontrado });
        }
    }

    // Huérfanos: índices públicos no declarados en REQUIRED.
    // Advertencia (salida 0): puede ser un índice legítimo recién creado.
    // Filtramos PKs, FKs y _key que Prisma genera — el ruido habitual.
    const orphans = rows
        .filter(
            (r: FilaIndice) =>
                !expectedNames.has(r.indexname) &&
                !r.indexname.endsWith("_pkey") &&
                !r.indexname.endsWith("_fkey") &&
                !r.indexname.endsWith("_key")
        )
        .map((r: FilaIndice) => r.indexname);

    const durationMs = Date.now() - inicio;
    return {
        ok: missing.length === 0 && wrongType.length === 0,
        missing,
        wrongType,
        orphans,
        checkedAt: new Date().toISOString(),
        durationMs,
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Formateador de salida humana (conserva prefijo [VERIFY HNSW] en primer mensaje
// para no romper greps existentes; el detalle usa [INDICES]).
// ────────────────────────────────────────────────────────────────────────────
function imprimirResultado(res: ResultadoVerificacion): void {
    for (const name of res.missing) {
        const req = REQUIRED.find((r) => r.name === name)!;
        console.error(
            `[INDICES] FALTA: ${name} (tabla ${req.table}) — ${req.sostiene}`
        );
    }
    for (const { name, expected, found } of res.wrongType) {
        const req = REQUIRED.find((r) => r.name === name)!;
        console.error(
            `[INDICES] TIPO INCORRECTO: ${name} (tabla ${req.table}) — esperado=${expected} encontrado=${found} — ${req.sostiene}`
        );
    }
    for (const name of res.orphans) {
        console.warn(
            `[INDICES] HUÉRFANO: ${name} — no está en REQUIRED; agrégalo si es intencional`
        );
    }

    if (res.ok) {
        // Mantener [VERIFY HNSW] en el mensaje final de éxito para backward compat.
        console.log(`[VERIFY HNSW] Todos los índices están presentes (${REQUIRED.length}/${REQUIRED.length}) · ${res.durationMs}ms`);
        for (const req of REQUIRED) {
            console.log(`[INDICES] OK: ${req.name}`);
        }
    } else {
        console.error(
            `[VERIFY HNSW] Índices críticos en mal estado: ${res.missing.length} faltantes, ${res.wrongType.length} tipo incorrecto.`
        );
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Entrypoint: solo corre cuando se ejecuta directamente (no al importar)
// ────────────────────────────────────────────────────────────────────────────
const esEntryPoint =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("verify-hnsw-indexes.ts") ||
        process.argv[1].endsWith("verify-hnsw-indexes.js"));

if (esEntryPoint) {
    // Timeout duro de 5s: si pg_indexes no responde, el guardián no cuelga CI ni deploy.
    const watchdog = setTimeout(() => {
        console.error("[INDICES] TIMEOUT: el chequeo tardó más de 5s — revisar conectividad a BD");
        process.exit(2);
    }, 5000);
    watchdog.unref();

    const jsonMode = process.argv.includes("--json");

    verificarIndices()
        .then((res) => {
            clearTimeout(watchdog);
            if (jsonMode) {
                console.log(JSON.stringify(res));
            } else {
                imprimirResultado(res);
            }
            if (!res.ok) process.exitCode = 1;
        })
        .catch((error) => {
            clearTimeout(watchdog);
            if (jsonMode) {
                console.log(JSON.stringify({ ok: false, error: String(error.message ?? error) }));
            } else {
                console.error("[INDICES] Error de infraestructura:", error.message ?? error);
            }
            process.exitCode = 2;
        })
        .finally(async () => {
            await prisma.$disconnect();
        });
}
