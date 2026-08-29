import type { PlantillaId } from "./tipos";

export interface ResultadoPlantilla {
    plantilla: PlantillaId;
    respuestaNarrativa: string;
    graficoSpec?: object;
}

const TEXTO_SIN_DATOS =
    "No hay datos operativos para esa consulta en tu ámbito. Puede ser que aún no se registren eventos de esa categoría o el criterio sea muy específico.";

const LIMITE_GRAFICO = 25;

function esCategorico(v: unknown): v is string {
    return typeof v === "string" && v.length > 0 && v.length < 80;
}

function esNumerico(v: unknown): v is number {
    return typeof v === "number" && Number.isFinite(v);
}

function detectarBarChart(filas: Array<Record<string, unknown>>): {
    catCol: string;
    numCol: string;
} | null {
    if (filas.length === 0 || filas.length > LIMITE_GRAFICO) return null;
    const primera = filas[0];
    const claves = Object.keys(primera);
    let catCol: string | null = null;
    let numCol: string | null = null;
    for (const k of claves) {
        if (!catCol && esCategorico(primera[k])) catCol = k;
        else if (!numCol && esNumerico(primera[k])) numCol = k;
    }
    if (!catCol || !numCol) return null;
    for (const fila of filas) {
        if (!esCategorico(fila[catCol]) || !esNumerico(fila[numCol])) {
            return null;
        }
    }
    return { catCol, numCol };
}

export function elegirPlantilla(
    filas: Array<Record<string, unknown>>,
): ResultadoPlantilla {
    if (filas.length === 0) {
        return { plantilla: "sin-datos", respuestaNarrativa: TEXTO_SIN_DATOS };
    }
    if (filas.length === 1) {
        const claves = Object.keys(filas[0]);
        if (claves.length === 1) {
            const valor = filas[0][claves[0]];
            if (esNumerico(valor)) {
                const tipo = claves[0].replace(/_/g, " ");
                return {
                    plantilla: "un-numero",
                    respuestaNarrativa: `Hay ${valor} ${tipo}.`,
                };
            }
        }
    }
    const bar = detectarBarChart(filas);
    if (bar) {
        const spec = {
            $schema: "https://vega.github.io/schema/vega-lite/v5.json",
            data: { values: filas },
            mark: "bar",
            encoding: {
                x: { field: bar.catCol, type: "nominal" },
                y: { field: bar.numCol, type: "quantitative" },
            },
        };
        return {
            plantilla: "grafico",
            respuestaNarrativa: `Se muestran ${filas.length} categorías.`,
            graficoSpec: spec,
        };
    }
    return {
        plantilla: "tabla",
        respuestaNarrativa: `Se devolvieron ${filas.length} filas.`,
    };
}
