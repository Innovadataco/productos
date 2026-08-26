/**
 * SPEC-284 (002-PI-184 · cierra I-130, I-137) — Compuerta de IDs de advisory lock.
 *
 * Verifica que los `ADVISORY_LOCK_ID` declarados en `scripts/*.mjs` sean únicos
 * (normalizando separadores `_` de JS antes de comparar) y que el conjunto
 * declarado en código coincida 1:1 con la tabla `scripts/ADVISORY-LOCKS.md`.
 *
 * Uso:
 *   npm run locks:check   → salida humana (exit 0 verde / 1 rojo / 2 timeout)
 *   tsx scripts/locks-check.ts --json  → salida JSON estable
 *
 * Solo I/O de archivos. Cero conexiones a Postgres.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

// ────────────────────────────────────────────────────────────────────────────
// Tipos
// ────────────────────────────────────────────────────────────────────────────
export interface DeclaracionLock {
    file: string;        // ruta relativa (p.ej. "scripts/worker-tasas.mjs")
    raw: string;         // literal tal como está en el archivo (con o sin `_`)
    normalizado: string; // literal sin `_`
    linea: number;       // línea 1-indexed donde aparece la declaración
}

export interface ResultadoVerificacion {
    ok: boolean;
    total: number;
    colisiones: { id: string; archivos: string[] }[];
    soloEnCodigo: string[];   // IDs declarados en .mjs que no están en la tabla
    soloEnTabla: string[];    // IDs listados en la tabla que no están en ningún .mjs
    varias: { file: string; declaraciones: DeclaracionLock[] }[]; // archivos con >1 declaración
    durationMs: number;
    checkedAt: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Extracción de declaraciones en scripts/*.mjs
// ────────────────────────────────────────────────────────────────────────────

// Match: const ADVISORY_LOCK_ID = <literal decimal con `_` opcionales> ;
// Permite decimales con separadores JS; ignora hex/exponencial (fuera de alcance v1).
const DECLARACION_RE = /^\s*const\s+ADVISORY_LOCK_ID\s*=\s*([0-9][0-9_]*)\s*;/gm;

export function extraerDeclaraciones(scriptsDir: string): DeclaracionLock[] {
    const archivos = readdirSync(scriptsDir).filter((f) => f.endsWith(".mjs")).sort();
    const decls: DeclaracionLock[] = [];
    for (const nombre of archivos) {
        const ruta = join(scriptsDir, nombre);
        const texto = readFileSync(ruta, "utf8");
        DECLARACION_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = DECLARACION_RE.exec(texto)) !== null) {
            const raw = m[1];
            // línea 1-indexed en la que empieza el match
            const linea = texto.slice(0, m.index).split("\n").length;
            decls.push({
                file: `scripts/${nombre}`,
                raw,
                normalizado: raw.replaceAll("_", ""),
                linea,
            });
        }
    }
    return decls;
}

// ────────────────────────────────────────────────────────────────────────────
// Parseo de scripts/ADVISORY-LOCKS.md — extrae la 1ª columna de la tabla
// ────────────────────────────────────────────────────────────────────────────

// Fila válida: `| \`<id>\` | ... |`
const FILA_TABLA_RE = /^\|\s*`([0-9][0-9_]*)`\s*\|/gm;

export function extraerIdsDeTabla(tablaPath: string): string[] {
    const texto = readFileSync(tablaPath, "utf8");
    const ids: string[] = [];
    FILA_TABLA_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = FILA_TABLA_RE.exec(texto)) !== null) {
        ids.push(m[1].replaceAll("_", ""));
    }
    return ids;
}

// ────────────────────────────────────────────────────────────────────────────
// Núcleo: verificarLocks — función pura testeable
// ────────────────────────────────────────────────────────────────────────────

export function verificarLocks({
    scriptsDir,
    tablaPath,
}: {
    scriptsDir: string;
    tablaPath: string;
}): ResultadoVerificacion {
    const inicio = Date.now();

    const decls = extraerDeclaraciones(scriptsDir);

    // Archivos con más de una declaración
    const porArchivo = new Map<string, DeclaracionLock[]>();
    for (const d of decls) {
        const lista = porArchivo.get(d.file) ?? [];
        lista.push(d);
        porArchivo.set(d.file, lista);
    }
    const varias = [...porArchivo.entries()]
        .filter(([, lista]) => lista.length > 1)
        .map(([file, declaraciones]) => ({ file, declaraciones }));

    // Colisiones por ID normalizado
    const porId = new Map<string, string[]>();
    for (const d of decls) {
        const lista = porId.get(d.normalizado) ?? [];
        lista.push(d.file);
        porId.set(d.normalizado, lista);
    }
    const colisiones = [...porId.entries()]
        .filter(([, archivos]) => archivos.length > 1)
        .map(([id, archivos]) => ({ id, archivos: [...archivos].sort() }))
        .sort((a, b) => a.id.localeCompare(b.id));

    // Diferencia con la tabla
    const idsCodigo = new Set(decls.map((d) => d.normalizado));
    const idsTabla = new Set(extraerIdsDeTabla(tablaPath));
    const soloEnCodigo = [...idsCodigo].filter((id) => !idsTabla.has(id)).sort();
    const soloEnTabla = [...idsTabla].filter((id) => !idsCodigo.has(id)).sort();

    const ok =
        colisiones.length === 0 &&
        soloEnCodigo.length === 0 &&
        soloEnTabla.length === 0 &&
        varias.length === 0;

    return {
        ok,
        total: decls.length,
        colisiones,
        soloEnCodigo,
        soloEnTabla,
        varias,
        durationMs: Date.now() - inicio,
        checkedAt: new Date().toISOString(),
    };
}

// ────────────────────────────────────────────────────────────────────────────
// Salida humana
// ────────────────────────────────────────────────────────────────────────────

function imprimir(res: ResultadoVerificacion): void {
    for (const { file, declaraciones } of res.varias) {
        console.error(
            `[LOCKS] MÚLTIPLES DECLARACIONES en ${file}: ${declaraciones.length} (líneas ${declaraciones
                .map((d) => d.linea)
                .join(", ")})`,
        );
    }
    for (const { id, archivos } of res.colisiones) {
        console.error(`[LOCKS] COLISIÓN: ID ${id} declarado por ${archivos.join(", ")}`);
    }
    for (const id of res.soloEnCodigo) {
        console.error(
            `[LOCKS] DESALINEO: ID ${id} está en scripts/*.mjs pero falta en scripts/ADVISORY-LOCKS.md`,
        );
    }
    for (const id of res.soloEnTabla) {
        console.error(
            `[LOCKS] DESALINEO: ID ${id} está en scripts/ADVISORY-LOCKS.md pero no lo declara ningún .mjs`,
        );
    }

    if (res.ok) {
        console.log(`[LOCKS] OK — ${res.total} IDs verificados, sin colisiones · ${res.durationMs}ms`);
    } else {
        console.error(
            `[LOCKS] FALLO — ${res.colisiones.length} colisiones, ${res.soloEnCodigo.length} solo-en-código, ${res.soloEnTabla.length} solo-en-tabla, ${res.varias.length} archivos con múltiples declaraciones`,
        );
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Entry point
// ────────────────────────────────────────────────────────────────────────────

const esEntryPoint =
    process.argv[1] !== undefined &&
    (process.argv[1].endsWith("locks-check.ts") || process.argv[1].endsWith("locks-check.js"));

if (esEntryPoint) {
    const watchdog = setTimeout(() => {
        console.error("[LOCKS] TIMEOUT: la verificación tardó más de 5s — revisar I/O del filesystem");
        process.exit(2);
    }, 5000);
    watchdog.unref();

    const jsonMode = process.argv.includes("--json");
    const raiz = resolve(process.cwd());
    const scriptsDir = join(raiz, "scripts");
    const tablaPath = join(scriptsDir, "ADVISORY-LOCKS.md");

    try {
        const res = verificarLocks({ scriptsDir, tablaPath });
        clearTimeout(watchdog);
        if (jsonMode) {
            console.log(JSON.stringify(res));
        } else {
            imprimir(res);
        }
        if (!res.ok) process.exitCode = 1;
    } catch (error) {
        clearTimeout(watchdog);
        const msg = error instanceof Error ? error.message : String(error);
        if (jsonMode) {
            console.log(JSON.stringify({ ok: false, error: msg }));
        } else {
            console.error(`[LOCKS] Error de infraestructura: ${msg}`);
        }
        process.exitCode = 2;
    }
}
