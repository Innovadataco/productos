/**
 * SPEC-911 · Auto-detección del delimitador de un CSV.
 *
 * Excel en español (configuración regional con la coma como separador decimal) guarda
 * los CSV con punto y coma (`;`) en vez de coma. Nuestras plantillas se descargan con
 * coma, pero al abrirlas y re-guardarlas desde Excel salen con `;` → un parser que divide
 * SOLO por coma mete todo el encabezado en una sola columna y el validador reporta
 * "faltan TODAS las columnas obligatorias" aunque el encabezado las traiga.
 *
 * Fuente ÚNICA del sniff: la usan los dos parsers (carga-profesores y carga de alumnos).
 * Mira SOLO la primera línea (el encabezado), cuenta comas vs. puntos y coma FUERA de
 * comillas y usa el mayoritario. Default coma si empatan o no hay ninguno (la coma es el
 * estándar y el formato de nuestras plantillas).
 */
export function detectarDelimitadorCsv(text: string): "," | ";" {
    let comas = 0;
    let puntoYComa = 0;
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            // "" escapado dentro de comillas: salta el par, sigue dentro de comillas.
            if (inQuotes && text[i + 1] === '"') {
                i++;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (inQuotes) continue;
        if (c === "\n" || c === "\r") break; // solo la primera línea
        if (c === ",") comas++;
        else if (c === ";") puntoYComa++;
    }
    // Mayoritario; empate o cero → coma (default).
    return puntoYComa > comas ? ";" : ",";
}
