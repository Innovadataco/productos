/**
 * SPEC-224 (002-PI-125, FR-007): helpers PUROS del test SQL del panel de
 * reglas (sin acceso a BD): envoltura con LIMIT, huella del query para
 * auditoría, extracción de columnas y traducción de errores de PostgreSQL a
 * mensajes legibles sin stack trace. La ejecución real (transacción READ ONLY
 * + statement_timeout) vive en el DAL
 * (`ReglasRecomendacionRepository.ejecutarQuerySoloLectura`) por la frontera
 * Q-3; la orquestación en `src/lib/dal/services/reglas-admin.ts`.
 */
import { createHash } from "node:crypto";
import { sqlAnalizable } from "./validar-sql";

export const TIMEOUT_TEST_DEFAULT_MS = 5000;
export const MAX_FILAS_TEST_DEFAULT = 50;

/** Acota el statement_timeout del test (FR-007): 1000..30000 ms. */
export function acotarTimeoutMs(valor: number | null | undefined): number {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return TIMEOUT_TEST_DEFAULT_MS;
    return Math.max(1000, Math.min(30000, Math.floor(valor)));
}

/** Acota el máximo de filas de la muestra (FR-007): 1..200. */
export function acotarMaxFilas(valor: number | null | undefined): number {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return MAX_FILAS_TEST_DEFAULT;
    return Math.max(1, Math.min(200, Math.floor(valor)));
}

/**
 * Garantiza que la query devuelve como máximo `maxFilas` filas: si no declara
 * `LIMIT` exterior (o declara uno mayor), se envuelve como subconsulta
 * `SELECT * FROM (<query>) AS test_limit LIMIT <max>` (Edge Case de spec).
 * Un `LIMIT` exterior válido (≤ max) al final de la query se respeta.
 */
export function envolverConLimit(sql: string, maxFilas: number): string {
    const sinPuntoYComa = sql.trim().replace(/;+\s*$/, "");
    // LIMIT exterior: último token LIMIT <n> del SQL analizable (sin literales).
    const analizable = sqlAnalizable(sinPuntoYComa);
    const match = /\blimit\s+(\d+)\s*$/i.exec(analizable.trim());
    if (match) {
        const declarado = parseInt(match[1] ?? "0", 10);
        if (Number.isFinite(declarado) && declarado >= 0 && declarado <= maxFilas) {
            return sinPuntoYComa;
        }
    }
    return `SELECT * FROM (${sinPuntoYComa}) AS test_limit LIMIT ${maxFilas}`;
}

/** Huella irreversible del query para AuditLog (nunca el SQL completo). */
export function huellaQuery(sql: string): string {
    return createHash("sha256").update(sql, "utf8").digest("hex").slice(0, 16);
}

/** Columnas del resultado, tomadas de la primera fila de la muestra. */
export function extraerColumnas(filas: Array<Record<string, unknown>>): string[] {
    const primera = filas[0];
    if (!primera) return [];
    return Object.keys(primera);
}

/** Código de PostgreSQL para cancelación por statement_timeout. */
export const PG_CODIGO_TIMEOUT = "57014";

export function esErrorTimeoutPg(error: unknown): boolean {
    if (error && typeof error === "object") {
        if ("code" in error) {
            if ((error as { code?: unknown }).code === PG_CODIGO_TIMEOUT) return true;
            // Prisma envuelve errores de queries crudas como P2010 con el código
            // real de PostgreSQL en `meta.code` (cancelación por statement_timeout).
            const meta = (error as { meta?: { code?: unknown } }).meta;
            if (meta?.code === PG_CODIGO_TIMEOUT) return true;
        }
    }
    return false;
}

/**
 * Mensaje legible del fallo de PostgreSQL: primera línea del mensaje, truncada
 * a 300 chars, sin stack trace (Edge Case: tabla/columna inexistente, sintaxis).
 */
export function mensajeErrorPg(error: unknown, timeoutMs: number): string {
    if (esErrorTimeoutPg(error)) {
        return `La consulta excedió el tiempo máximo de prueba (${timeoutMs} ms)`;
    }
    const bruto = error instanceof Error ? error.message : String(error);
    const primeraLinea = bruto.split("\n", 1)[0] ?? "Error al ejecutar la consulta";
    const truncado = primeraLinea.slice(0, 300);
    return `La consulta falló: ${truncado}`;
}

/** Variables `{{variable}}` declaradas en una plantilla de recomendación. */
export function extraerVariablesPlantilla(plantilla: string): string[] {
    const variables = new Set<string>();
    for (const match of plantilla.matchAll(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)) {
        if (match[1]) variables.add(match[1]);
    }
    return [...variables];
}

/** Variables de la plantilla SIN columna correspondiente (advertencia US-2.4). */
export function variablesSinColumna(plantilla: string, columnas: string[]): string[] {
    const disponibles = new Set(columnas);
    return extraerVariablesPlantilla(plantilla).filter((v) => !disponibles.has(v));
}
