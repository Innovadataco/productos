/**
 * SPEC-234 (002-PI-134): plantilla markdown del informe consolidado.
 * Texto neutro, descriptivo y sin veredictos. NUNCA incluye texto original de reportes.
 */
import type { CategoriaAgregada } from "../queries/agregar-categorias";
import type { SenalComunitariaData } from "../queries/senal-comunitaria";
import type { ResultadoRegla } from "../reglas/aceleracion";

export interface RenderizarMarkdownInput {
    numEventos: number;
    categorias: CategoriaAgregada[];
    patrones: ResultadoRegla[];
    senal: SenalComunitariaData;
    score: number;
    gravedad: string;
}

function listaDesdeRecord(record: Record<string, number>): string {
    const entries = Object.entries(record);
    if (entries.length === 0) return "Sin registros.";
    return entries
        .sort((a, b) => b[1] - a[1])
        .map(([clave, total]) => `- ${clave}: ${total}`)
        .join("\n");
}

export function renderizarMarkdown(input: RenderizarMarkdownInput): string {
    const { numEventos, categorias, patrones, senal, score, gravedad } = input;

    const clasificacionesLinea =
        categorias.length > 0
            ? listaDesdeRecord(Object.fromEntries(categorias.map((c) => [c.categoria, c.totalEventos])))
            : "Sin clasificaciones registradas.";

    const patronesLinea =
        patrones.length > 0
            ? patrones.map((p, i) => `${i + 1}. **${p.severidad}** — ${p.descripcionTexto}`).join("\n")
            : "No se detectaron patrones estructurales.";

    const lineas = [
        "# Informe consolidado",
        "",
        "## Alcance",
        `Este informe resume ${numEventos} evento(s) registrados en el expediente. No incluye el texto original de los reportes ni datos personales; solo presenta agregados, patrones detectados y señal comunitaria con fines descriptivos.`,
        "",
        "## Clasificaciones",
        clasificacionesLinea,
        "",
        "## Resumen",
        `- Eventos considerados: ${numEventos}`,
        `- Categorías distintas detectadas: ${categorias.length}`,
        `- Patrones estructurales detectados: ${patrones.filter((p) => p.detectado).length}`,
        "",
        "## Patrones",
        patronesLinea,
        "",
        "## Señal comunitaria",
        `- Expedientes activos asociados: ${senal.totalExpedientesActivos}`,
        `- Expedientes cerrados asociados: ${senal.totalExpedientesCerrados}`,
        `- Expedientes escalados asociados: ${senal.totalExpedientesEscalados}`,
        "",
        "**Categorías frecuentes en la comunidad**",
        listaDesdeRecord(senal.categoriasFrecuenciaJson),
        "",
        "**Plataformas frecuentes en la comunidad**",
        listaDesdeRecord(senal.plataformasJson),
        "",
        "## Nivel de gravedad",
        `El score calculado es **${score.toFixed(2)}**, lo que corresponde al nivel **${gravedad}**.`,
        "",
        "---",
        "Este documento es una compilación técnica de eventos registrados por la comunidad. No constituye un veredicto ni una determinación de responsabilidad sobre persona alguna.",
    ];

    return lineas.join("\n");
}
