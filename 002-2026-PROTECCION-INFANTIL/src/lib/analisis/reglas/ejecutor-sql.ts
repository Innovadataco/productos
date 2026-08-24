/**
 * SPEC-221 (002-PI-122): validación estática de las queries de detección de
 * reglas (capa 1 del sandbox). Función pura, sin acceso a BD: la ejecución
 * real (transacción READ ONLY + statement_timeout, capa 2) vive en el DAL
 * (`ReglasRecomendacionRepository.ejecutarQuerySoloLectura`) por la frontera
 * Q-3 — desviación documentada respecto a plan.md §5.2, que juntaba ambas.
 *
 * Reglas:
 * - La query debe iniciar con SELECT o WITH (trim + case-insensitive).
 * - Ninguna palabra de la deny-list puede aparecer como token.
 */

/** Palabras prohibidas como token (escritura, DDL, ejecución de programas). */
export const DENY_LIST_SQL = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "GRANT",
    "REVOKE",
    "COPY",
    "EXECUTE",
    "CALL",
    "CREATE",
    "SET",
] as const;

export type ResultadoValidacionSql = { ok: true } | { ok: false; motivo: string };

/** Quita comentarios de línea (--) y de bloque (\/\* ... \*\/) antes de tokenizar. */
function sinComentarios(sql: string): string {
    return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

export function validarSqlRegla(sql: string): ResultadoValidacionSql {
    const limpio = sinComentarios(sql).trim();
    if (limpio.length === 0) {
        return { ok: false, motivo: "La query está vacía" };
    }
    const primeraPalabra = limpio.split(/\s+/, 1)[0]?.toUpperCase() ?? "";
    if (primeraPalabra !== "SELECT" && primeraPalabra !== "WITH") {
        return { ok: false, motivo: "La query debe iniciar con SELECT o WITH" };
    }
    const tokens = limpio.toUpperCase().split(/[^A-Z_]+/);
    for (const palabra of DENY_LIST_SQL) {
        if (tokens.includes(palabra)) {
            return { ok: false, motivo: `La query contiene la palabra prohibida ${palabra}` };
        }
    }
    return { ok: true };
}
