/**
 * SPEC-221 (002-PI-122): renderer de plantillas de recomendación.
 *
 * Sustitución simple de `{{variable}}` sobre los valores de la fila candidata
 * (sin dependencia nueva). Convenciones:
 * - Variable ausente en la fila → el placeholder queda visible (`{{variable}}`)
 *   y se loguea warning; nunca rompe la generación del resto de candidatos.
 * - La plantilla produce `titulo` y `descripcion` por convención de split:
 *   primera línea no vacía = título; el resto (unido con \n) = descripción.
 */

export interface ResultadoRender {
    titulo: string;
    descripcion: string;
    /** Variables referenciadas en la plantilla que la fila no expone. */
    variablesAusentes: string[];
}

const PLACEHOLDER_RE = /\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g;

function aTexto(valor: unknown): string {
    if (valor instanceof Date) return valor.toISOString().slice(0, 10);
    if (typeof valor === "string") return valor;
    if (typeof valor === "number" || typeof valor === "boolean" || typeof valor === "bigint") {
        return String(valor);
    }
    if (valor === null || valor === undefined) return "";
    return JSON.stringify(valor);
}

/** Renderiza la plantilla completa (título + descripción en un solo texto). */
export function renderPlantilla(plantilla: string, fila: Record<string, unknown>): ResultadoRender {
    const ausentes = new Set<string>();
    const renderizado = plantilla.replace(PLACEHOLDER_RE, (match, nombre: string) => {
        if (!(nombre in fila)) {
            ausentes.add(nombre);
            return match;
        }
        return aTexto(fila[nombre]);
    });

    const lineas = renderizado.split("\n");
    const indiceTitulo = lineas.findIndex((l) => l.trim().length > 0);
    const titulo = indiceTitulo >= 0 ? lineas[indiceTitulo]!.trim() : "";
    const descripcion = (indiceTitulo >= 0 ? lineas.slice(indiceTitulo + 1) : [])
        .join("\n")
        .trim();

    const variablesAusentes = [...ausentes];
    if (variablesAusentes.length > 0) {
        console.warn(
            `[Analisis/Reglas] Plantilla con variables ausentes en la fila: ${variablesAusentes.join(", ")}`
        );
    }
    return { titulo, descripcion, variablesAusentes };
}
