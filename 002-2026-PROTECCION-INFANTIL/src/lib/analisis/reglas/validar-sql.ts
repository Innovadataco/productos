/**
 * SPEC-224 (002-PI-125, FR-006): validador estático de SQL para el panel de
 * reglas configurables. Función pura, sin acceso a BD. Es la barrera SECUNDARIA
 * del sandbox: la garantía real es la transacción READ ONLY + statement_timeout
 * del DAL (`ReglasRecomendacionRepository.ejecutarQuerySoloLectura`); este
 * validador existe para rechazar lo obviamente inválido ANTES de ejecutar y
 * para proteger el guardado de reglas (que luego evalúa el worker de SPEC-221).
 *
 * Diferencias con el validador del motor (SPEC-221, `ejecutor-sql.ts`): este
 * distingue literales (una palabra prohibida dentro de '...' no es mutación) y
 * rechaza multi-sentencia. Falla cerrado: ante la duda, rechaza.
 *
 * Reglas:
 * - Se quitan comentarios (-- y /* *​/) y literales ('...' con escape '', y
 *   cadenas dollar-quoted $tag$...$tag$) antes de analizar.
 * - La query debe iniciar con SELECT o WITH.
 * - Una sola sentencia: se permite un único ';' final sin contenido después.
 * - Ninguna palabra de mutación puede aparecer como token fuera de literales.
 */

/** Palabras prohibidas como token (escritura, DDL, ejecución de programas). */
export const DENY_LIST_SQL_PANEL = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "ALTER",
    "TRUNCATE",
    "CREATE",
    "GRANT",
    "REVOKE",
    "COPY",
    "CALL",
    "DO",
    "EXECUTE",
] as const;

export type ResultadoValidacionSqlPanel = { ok: true } | { ok: false; motivo: string };

/** Quita comentarios de línea (--) y de bloque (\/\* ... \*\/). */
function sinComentarios(sql: string): string {
    return sql.replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ");
}

/**
 * Reemplaza por un espacio los literales de cadena: comillas simples (con
 * escape ''), identificadores entre comillas dobles y cadenas dollar-quoted
 * ($$...$$ o $tag$...$tag$). Lo que queda es SQL analizable por tokens.
 */
export function sinLiterales(sql: string): string {
    return sql
        .replace(/\$([A-Za-z_][A-Za-z0-9_]*)?\$[\s\S]*?\$\1\$/g, " ")
        .replace(/'(?:[^']|'')*'/g, " ")
        .replace(/"(?:[^"]|"")*"/g, " ");
}

/** Texto de la query listo para análisis: sin comentarios ni literales. */
export function sqlAnalizable(sql: string): string {
    return sinLiterales(sinComentarios(sql));
}

export function validarSqlReglaPanel(sql: string): ResultadoValidacionSqlPanel {
    const limpio = sqlAnalizable(sql).trim();
    if (limpio.length === 0) {
        return { ok: false, motivo: "La query está vacía" };
    }
    // Falla cerrado: una comilla que sobrevivió al saneado es un literal (o
    // identificador) sin cerrar — no se puede analizar con seguridad.
    if (limpio.includes("'") || limpio.includes('"')) {
        return { ok: false, motivo: "La query tiene un literal o identificador sin cerrar" };
    }
    const primeraPalabra = limpio.split(/\s+/, 1)[0]?.toUpperCase() ?? "";
    if (primeraPalabra !== "SELECT" && primeraPalabra !== "WITH") {
        return { ok: false, motivo: "La query debe iniciar con SELECT o WITH" };
    }
    // Multi-sentencia: un ';' con contenido (no blanco) después.
    const idxPuntoYComa = limpio.indexOf(";");
    if (idxPuntoYComa !== -1 && limpio.slice(idxPuntoYComa + 1).trim().length > 0) {
        return { ok: false, motivo: "Solo se permite una sentencia (sin ';' intermedios)" };
    }
    const tokens = limpio.toUpperCase().split(/[^A-Z_]+/);
    for (const palabra of DENY_LIST_SQL_PANEL) {
        if (tokens.includes(palabra)) {
            return { ok: false, motivo: `La query contiene la palabra prohibida ${palabra}` };
        }
    }
    return { ok: true };
}
