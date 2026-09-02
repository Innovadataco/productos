// src/lib/bi/validador-sql.ts · Validador determinístico post-construcción (candados 5 y 6)
// Producto 006 · BI v2 · Motor NL→SQL
// Defensa en profundidad sobre el SQL que arma constructor-sql.ts (y guarda
// de CUALQUIER SQL que pretenda ejecutarse contra la réplica): solo lectura.
// Candado 5: si el validador NO aprueba, la consulta no se ejecuta — se
// registra y escala a revisión humana; jamás se ejecuta "a ver qué pasa".
// Deny-by-default: cada chequeo que falla agrega una violación y con una
// sola la statement se rechaza completa.

import type { Catalogo } from "@/lib/bi/catalogo";

export interface ResultadoValidacion {
    valida: boolean;
    violaciones: string[];
}

/** Tope absoluto de filas: un LIMIT literal mayor se rechaza aunque la statement esté bien formada. */
const LIMITE_MAXIMO_FILAS = 10000;

/**
 * Palabras reservadas aceptadas como tales en el análisis de identificadores
 * (no se tratan como columnas). Cualquier otra palabra desnuda debe ser una
 * columna del catálogo de la(s) tabla(s) del FROM.
 */
const PALABRAS_SQL: ReadonlySet<string> = new Set([
    "select", "from", "where", "and", "or", "not", "as", "distinct", "all",
    "like", "ilike", "in", "between", "is", "null", "exists",
    "count", "sum", "avg", "min", "max", "coalesce", "cast", "extract", "date_trunc",
    "lower", "upper", "text", "date",
    "limit", "offset", "order", "by", "asc", "desc", "group", "having",
    "now", "interval", "day", "days", "week", "weeks", "month", "months", "year", "years",
    "hour", "hours", "minute", "minutes",
    "case", "when", "then", "else", "end", "true", "false",
    "join", "inner", "left", "right", "full", "outer", "cross", "on", "union",
]);

/** Palabras de escritura, DDL o administración prohibidas en cualquier parte (límite de palabra, case-insensitive). */
const PALABRAS_PROHIBIDAS = /\b(insert|update|delete|drop|alter|truncate|grant|revoke|copy|execute|call|do)\b/i;

/**
 * Valida una statement SQL contra el catálogo. Devuelve TODAS las violaciones
 * encontradas (no corta en la primera) para que el registro/escalado del
 * candado 5 tenga el cuadro completo.
 *
 * Nota LIMIT: el constructor emite `LIMIT $N` parametrizado (ya con clamp en
 * servidor), valor que aquí no se puede evaluar; se acepta el placeholder y
 * se exige literal numérico ≤ LIMITE_MAXIMO_FILAS cuando el LIMIT es literal.
 */
export function validarSql(cat: Catalogo, sql: string): ResultadoValidacion {
    const violaciones: string[] = [];
    const sqlTrim = (sql ?? "").trim();

    if (sqlTrim.length === 0) {
        return { valida: false, violaciones: ["El SQL está vacío."] };
    }

    // 1 · Debe empezar con SELECT: única operación permitida contra la réplica.
    if (!/^select\b/i.test(sqlTrim)) {
        violaciones.push("El SQL debe empezar con SELECT (solo lectura).");
    }

    // Literales de texto fuera del análisis léxico: el constructor no los emite
    // (valores parametrizados) y un literal podría esconder ';' o marcadores de
    // comentario que no son reales.
    const sinLiterales = sqlTrim.replace(/'(?:[^']|'')*'/g, " ");

    // 2 · Una sola statement: sin ';' intermedio ni final.
    if (sinLiterales.includes(";")) {
        violaciones.push("Solo se permite una statement: se detectó ';'.");
    }

    // 3 · Sin comentarios SQL de ningún tipo.
    if (/--|\/\*|\*\//.test(sinLiterales)) {
        violaciones.push("No se permiten comentarios SQL (-- o /* */).");
    }

    // 4 · Palabras prohibidas (escritura · DDL · administración), con límite de
    //    palabra: una columna como "updatedAt" NO dispara la guarda.
    const prohibida = sinLiterales.match(PALABRAS_PROHIBIDAS);
    if (prohibida) {
        violaciones.push(`Palabra prohibida detectada: ${prohibida[0].toUpperCase()}.`);
    }

    // 5 · Tablas del FROM: solo tablas del catálogo (coincidencia exacta).
    const tablasFrom: string[] = [];
    const reFrom = /\bfrom\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;
    let m: RegExpExecArray | null;
    while ((m = reFrom.exec(sinLiterales)) !== null) {
        tablasFrom.push(m[1] ?? m[2]);
    }
    if (tablasFrom.length === 0) {
        violaciones.push("No se encontró una tabla en el FROM.");
    }
    const columnasPermitidas = new Set<string>();
    for (const nombreTabla of tablasFrom) {
        const tabla = cat.tablas.find((t) => t.nombreFuente === nombreTabla);
        if (!tabla) {
            violaciones.push(`Tabla fuera del catálogo: "${nombreTabla}".`);
            continue;
        }
        for (const col of tabla.columnas) {
            columnasPermitidas.add(col.nombreFuente);
        }
    }

    // 6 · Columnas: todo identificador debe ser columna del catálogo de la(s)
    //    tabla(s) del FROM (se omite si el FROM ya falló: ruido redundante).
    if (columnasPermitidas.size > 0) {
        // Aliases declarados con AS (p.ej. `AS valor` / `AS grupo` del GROUP BY
        // del constructor): referenciarlos después (ORDER BY valor DESC) es SQL
        // legítimo. Se aceptan SOLO los aliases efectivamente declarados — no
        // se abre la puerta a palabras nuevas fuera del catálogo.
        const aliases = new Set<string>();
        const reAlias = /\bas\s+(?:"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))/gi;
        while ((m = reAlias.exec(sinLiterales)) !== null) {
            aliases.add(m[1] ?? m[2]);
        }

        // Referencias de tabla del FROM y aliases AS no son columnas.
        let texto = sinLiterales.replace(/\bfrom\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)/gi, " FROM ");
        texto = texto.replace(/\bas\s+(?:"[^"]+"|[A-Za-z_][A-Za-z0-9_]*)/gi, " ");

        // 6a · Identificadores entre comillas dobles (excepto *, count y aliases AS, ya retirados).
        const reCitado = /"([^"]+)"/g;
        const citadasReportadas = new Set<string>();
        while ((m = reCitado.exec(texto)) !== null) {
            if (!columnasPermitidas.has(m[1]) && !aliases.has(m[1]) && !citadasReportadas.has(m[1])) {
                citadasReportadas.add(m[1]);
                violaciones.push(`Columna fuera del catálogo: "${m[1]}".`);
            }
        }

        // 6b · Identificadores desnudos: solo palabras SQL conocidas o columnas del catálogo.
        const sinCitados = texto.replace(/"[^"]*"/g, " ");
        const rePalabra = /[A-Za-z_][A-Za-z0-9_]*/g;
        const desnudasReportadas = new Set<string>();
        while ((m = rePalabra.exec(sinCitados)) !== null) {
            const palabra = m[0];
            if (PALABRAS_SQL.has(palabra.toLowerCase())) continue;
            if (!columnasPermitidas.has(palabra) && !aliases.has(palabra) && !desnudasReportadas.has(palabra)) {
                desnudasReportadas.add(palabra);
                violaciones.push(`Identificador no permitido (no es columna del catálogo): ${palabra}.`);
            }
        }
    }

    // 7 · LIMIT obligatorio (ver nota del encabezado sobre el placeholder $N).
    const limitLiteral = sinLiterales.match(/\blimit\s+(\d+)\b/i);
    if (limitLiteral) {
        if (parseInt(limitLiteral[1], 10) > LIMITE_MAXIMO_FILAS) {
            violaciones.push(`LIMIT ${limitLiteral[1]} supera el máximo permitido (${LIMITE_MAXIMO_FILAS}).`);
        }
    } else if (!/\blimit\s+\$\d+\b/i.test(sinLiterales)) {
        violaciones.push("LIMIT obligatorio ausente (debe ser valor numérico o parámetro).");
    }

    return { valida: violaciones.length === 0, violaciones };
}
