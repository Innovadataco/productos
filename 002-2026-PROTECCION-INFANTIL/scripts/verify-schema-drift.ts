/**
 * SPEC-760 (D-121) · Guardián de DRIFT de esquema — BLANDO, solo-lectura, contra la BD VIVA.
 *
 * Nace del hallazgo de SPEC-759: dos FK que el esquema declara y que ninguna migración creó
 * nunca faltaban en prod, en la BD de test compartida Y en un CI fresco — porque CI arma la
 * base desde las migraciones, que tampoco las tienen. Un guardián sobre base FRESCA nunca lo
 * vería. Por eso este corre CONTRA LA BASE VIVA (prod / test compartida), no un CI de cero.
 *
 * DISEÑO (calcado de `verify-hnsw-indexes.ts`, generalizado de «5 índices» a «todo el esquema»):
 *  - Motor: `prisma migrate diff --from-schema-datamodel <schema> --to-url <VIVA> --script`
 *    (SOLO observa; migrate diff no toca nada). Corré con un rol de SOLO LECTURA para que
 *    escribir sea imposible por construcción (`crear-usuario-zeus-readonly.sh`).
 *  - BLANDO: exit 0 SIEMPRE aunque haya drift (WARN legible), porque el set es ABIERTO y puede
 *    empezar rojo. NUNCA gate duro de deploy (contraste con verify-hnsw, cuyo set es cerrado y
 *    debe existir). exit 2 solo para error de infra, con watchdog — no cuelga a nadie.
 *  - Catálogo BASELINE = el punto ciego SISTEMÁTICO de Prisma + objetos crudos conocidos, cada
 *    entrada con RAZÓN escrita. NO incluye las 2 FK de SPEC-759: esas son la reparación, no
 *    baseline (un baseline que se traga el hallazgo es peor que no vigilar).
 *  - CONSERVADOR: una sentencia es benigna SOLO si calza LIMPIO con una regla del baseline;
 *    cualquier otra cosa es DRIFT. Así un índice crudo NUEVO nace ROJO hasta que se agregue al
 *    baseline a conciencia (con su razón), no en silencio.
 *  - Criterio de cierre de la SPEC: tras desplegar SPEC-759, el guardián debe NACER VERDE contra
 *    la base viva. Si nace rojo, o el baseline está incompleto o hay drift sin triar — información,
 *    no motivo para ampliar el baseline.
 *  - Corré con el esquema DESPLEGADO contra la base de esa MISMA versión; un esquema de rama por
 *    detrás/delante reporta SKEW de versión como falso positivo (blando, así que es ruido, no daño).
 *
 * Uso:
 *   node --env-file=.env.production --import tsx scripts/verify-schema-drift.ts
 *   node ... scripts/verify-schema-drift.ts --json
 * Exit: 0 = sin drift real (o drift reportado, BLANDO) · 2 = error de infra.
 */
import { execFileSync } from "node:child_process";

// ────────────────────────────────────────────────────────────────────────────
// Catálogo BASELINE — el punto ciego de Prisma + objetos crudos conocidos.
// Cada entrada lleva RAZÓN. Derivado del MISMO catálogo que verify-hnsw (los 5
// índices REQUIRED) + los parciales/extension medidos en prod (SPEC-759).
// NO incluye las 2 FK de SPEC-759 (son reparación, jamás baseline).
// ────────────────────────────────────────────────────────────────────────────

/** Índices crudos que Prisma NO modela y que QUEREMOS en la base (trigram, vector, parciales). */
export const INDICES_CRUDOS_BASELINE: Record<string, string> = {
    // Los 5 de verify-hnsw (fuente única compartida):
    Ciudad_nombreNormalizado_trgm_idx: "trigram de ciudades (I-45); Prisma no modela GIN gin_trgm_ops",
    EmbeddingDataset_vector_idx: "HNSW vector del motor IA (dedup); Prisma no modela hnsw",
    EmbeddingReporte_vector_idx: "HNSW vector del motor IA (RAG); Prisma no modela hnsw",
    AlertaColegio_patronInstitucionalId_idx: "btree crudo por migración; Prisma lo re-emite como drift",
    patrones_institucionales_colegioId_periodo_grado_conducta_p_key: "unique compuesto truncado a 63 chars (excepción documentada)",
    // Parciales (WHERE) que Prisma es ciego a modelar (medidos en prod, SPEC-759):
    idx_reportes_tenant_creado_eliminado: "índice PARCIAL de reportes (WHERE eliminado); Prisma no ve el WHERE",
    idx_reportes_tenant_estado_eliminado: "índice PARCIAL de reportes (WHERE eliminado); Prisma no ve el WHERE",
    idx_reportes_usuario_eliminado: "índice PARCIAL de reportes (WHERE eliminado); Prisma no ve el WHERE",
    idx_solicitudes_comite_colegio_estado: "índice PARCIAL de solicitudes de comité; Prisma no ve el WHERE",
};

/** Extensiones que gestionamos por SQL crudo, no por Prisma. */
export const EXTENSIONES_BASELINE: Record<string, string> = {
    pg_trgm: "extensión para búsqueda trigram; se instala por SQL crudo",
    plpgsql: "extensión base de PostgreSQL; presente por defecto",
};

/** Tablas del ARNÉS de test (existen en las BD de test, no en el esquema Prisma). */
export const TABLAS_ARNES_TEST_BASELINE: Record<string, string> = {
    TestMutex: "mutex del arnés de integración (test-setup); no es del dominio, solo en BD de test",
};

// ────────────────────────────────────────────────────────────────────────────
// Clasificación (pura, exportada para el candado). Conservadora: benigna SOLO si
// calza limpio; todo lo demás es DRIFT.
// ────────────────────────────────────────────────────────────────────────────
export interface Clasificacion {
    benignas: { stmt: string; categoria: string; razon: string }[];
    drift: string[];
}

/** Parte el `--script` de migrate diff en sentencias (DDL termina en `;`). Quita primero las
 *  LÍNEAS de comentario (`--`): no terminan en `;`, así que si no se sacan antes, se pegan a la
 *  sentencia siguiente y la arrastran fuera. */
export function partirStatements(script: string): string[] {
    return script
        .split("\n")
        .filter((linea) => !linea.trim().startsWith("--"))
        .join("\n")
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => s + ";");
}

function primeraPalabraClave(stmt: string): string {
    return stmt.replace(/^\s+/, "").slice(0, 400).toUpperCase();
}

/**
 * Un `ALTER TABLE` cuyas cláusulas son TODAS punto ciego benigno de Prisma:
 *  - cambio de tipo a TIMESTAMPTZ (I-420: Prisma no modela timestamptz), o
 *  - `SET DEFAULT` de un valor de REPRESENTACIÓN conocida que Prisma no round-trippea
 *    (now()/CURRENT_TIMESTAMP, gen_random_uuid(), ARRAY[...], literal '…', número, bool).
 * CONSERVADOR: si ALGUNA cláusula es ADD/DROP COLUMN, SET/DROP NOT NULL, DROP DEFAULT, un
 * SET DATA TYPE que no sea timestamptz, o un SET DEFAULT de un valor NO conocido → NO es
 * benigno (nace rojo). Así `Plan ADD COLUMN … , precio SET NOT NULL` sigue siendo drift.
 */
const CLAUSULA_TIPO_TS = /^ALTER COLUMN\s+"[^"]+"\s+SET DATA TYPE TIMESTAMPTZ(\(\d+\))?(\s+USING\b.*)?$/i;
const VALOR_DEFAULT_BENIGNO = /^(CURRENT_TIMESTAMP|now\(\)|gen_random_uuid\(\)|ARRAY\[[^\]]*\](::[A-Za-z0-9_" ]+(\[\])?)?|'[^']*'|-?\d+(\.\d+)?|true|false)$/i;
const CLAUSULA_SET_DEFAULT = /^ALTER COLUMN\s+"[^"]+"\s+SET DEFAULT\s+(.+)$/i;

function esAlterColumnaBenigno(stmt: string): boolean {
    const t = stmt.trim();
    if (!/^ALTER TABLE\s+"[^"]+"/i.test(t)) return false;
    const cuerpo = t.replace(/^ALTER TABLE\s+"[^"]+"\s*/i, "").replace(/;$/, "").trim();
    if (cuerpo.length === 0) return false;
    // Partir en cláusulas: cada una empieza en ALTER/ADD/DROP.
    const clausulas = cuerpo.split(/,(?=\s*(?:ALTER|ADD|DROP)\b)/i).map((c) => c.trim());
    return clausulas.every((c) => {
        if (CLAUSULA_TIPO_TS.test(c)) return true;
        const m = c.match(CLAUSULA_SET_DEFAULT);
        return m !== null && VALOR_DEFAULT_BENIGNO.test(m[1].trim());
    });
}

function extraerNombre(stmt: string, re: RegExp): string | null {
    return stmt.match(re)?.[1] ?? null;
}

export function clasificarDrift(statements: string[]): Clasificacion {
    const benignas: Clasificacion["benignas"] = [];
    const drift: string[] = [];

    for (const stmt of statements) {
        const kw = primeraPalabraClave(stmt);

        // 1) ALTER COLUMN de representación (timestamptz y/o SET DEFAULT conocido) — punto ciego de Prisma.
        if (esAlterColumnaBenigno(stmt)) {
            benignas.push({ stmt, categoria: "prisma-representacion", razon: "punto ciego de Prisma (I-420): cambio a TIMESTAMPTZ y/o SET DEFAULT de representación conocida (now()/uuid/array/literal); la base tiene el estado correcto" });
            continue;
        }
        // 2) CREATE EXTENSION — por nombre conocido.
        if (kw.startsWith("CREATE EXTENSION")) {
            const ext = extraerNombre(stmt, /CREATE EXTENSION(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/i);
            if (ext && ext in EXTENSIONES_BASELINE) {
                benignas.push({ stmt, categoria: "extension", razon: EXTENSIONES_BASELINE[ext] });
                continue;
            }
        }
        // 3) ALTER INDEX ... RENAME — skew de nombre; el índice EXISTE, solo cambia el nombre (categoría benigna).
        if (/^ALTER INDEX\s+"[^"]+"\s+RENAME TO\s+"[^"]+"\s*;?$/i.test(stmt.trim())) {
            benignas.push({ stmt, categoria: "rename-indice", razon: "renombre de índice existente (skew de nombre Prisma↔migración); no cambia el índice" });
            continue;
        }
        // 4) CREATE INDEX — SOLO si el nombre está en el catálogo de índices crudos conocidos.
        if (/^CREATE (UNIQUE )?INDEX/i.test(stmt.trim())) {
            const idx = extraerNombre(stmt, /CREATE (?:UNIQUE )?INDEX(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/i);
            if (idx && idx in INDICES_CRUDOS_BASELINE) {
                benignas.push({ stmt, categoria: "indice-crudo", razon: INDICES_CRUDOS_BASELINE[idx] });
                continue;
            }
        }
        // 5) CREATE TABLE "TestMutex" — arnés de test conocido.
        if (/^CREATE TABLE/i.test(stmt.trim())) {
            const tbl = extraerNombre(stmt, /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+"([^"]+)"/i);
            if (tbl && tbl in TABLAS_ARNES_TEST_BASELINE) {
                benignas.push({ stmt, categoria: "arnes-test", razon: TABLAS_ARNES_TEST_BASELINE[tbl] });
                continue;
            }
        }
        // Cualquier otra cosa = DRIFT (conservador: nace rojo hasta triar).
        drift.push(stmt);
    }

    return { benignas, drift };
}

// ────────────────────────────────────────────────────────────────────────────
// Motor: obtiene el drift de la base VIVA (shell a prisma migrate diff). No unit-testeado.
// ────────────────────────────────────────────────────────────────────────────
export function obtenerScriptDeDrift(schemaPath = "prisma/schema.prisma", dbUrl = process.env.DATABASE_URL): string {
    if (!dbUrl) throw new Error("[drift] DATABASE_URL no definido — apuntá a la BD VIVA con un rol de SOLO LECTURA.");
    return execFileSync(
        "npx",
        ["prisma", "migrate", "diff", "--from-schema-datamodel", schemaPath, "--to-url", dbUrl, "--script"],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
}

// ────────────────────────────────────────────────────────────────────────────
// Entrypoint: BLANDO. exit 0 aun con drift (WARN); exit 2 solo infra; watchdog.
// ────────────────────────────────────────────────────────────────────────────
const esEntryPoint =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("verify-schema-drift.ts") || process.argv[1].endsWith("verify-schema-drift.js"));

if (esEntryPoint) {
    const jsonMode = process.argv.includes("--json");
    const watchdog = setTimeout(() => {
        console.error("[drift] TIMEOUT: migrate diff tardó más de 20s — revisar conectividad a la BD viva");
        process.exit(2);
    }, 20000);
    watchdog.unref();

    try {
        const script = obtenerScriptDeDrift();
        const { benignas, drift } = clasificarDrift(partirStatements(script));
        clearTimeout(watchdog);

        if (jsonMode) {
            console.log(JSON.stringify({ ok: drift.length === 0, driftReal: drift.length, benignas: benignas.length, drift }));
        } else {
            const porCategoria = benignas.reduce<Record<string, number>>((acc, b) => {
                acc[b.categoria] = (acc[b.categoria] ?? 0) + 1;
                return acc;
            }, {});
            console.log(`[drift] baseline benigno: ${benignas.length} sentencias (${Object.entries(porCategoria).map(([k, v]) => `${k}=${v}`).join(", ") || "ninguna"})`);
            if (drift.length === 0) {
                console.log("[drift] VERDE: cero drift real — el esquema vivo coincide con lo declarado (salvo el punto ciego de Prisma, baselineado con razón).");
            } else {
                console.warn(`[drift] ⚠️ ${drift.length} DRIFT REAL (guardián BLANDO — no bloquea, pero triar YA):`);
                for (const d of drift) console.warn(`  · ${d}`);
                console.warn("[drift] Triar: reparar (migración aditiva) o, si es un objeto crudo legítimo nuevo, agregarlo al baseline CON RAZÓN.");
            }
        }
        // BLANDO: nunca exit≠0 por drift. Solo infra (abajo) sube 2.
    } catch (error) {
        clearTimeout(watchdog);
        const msg = error instanceof Error ? error.message : String(error);
        if (jsonMode) console.log(JSON.stringify({ ok: false, error: msg }));
        else console.error("[drift] Error de infra (¿BD viva inalcanzable? ¿migrate diff falló?):", msg);
        process.exitCode = 2;
    }
}
