/**
 * SPEC-308 (A-50): renderizado puro del email enriquecido de alerta del
 * Círculo de Confianza. Sin LLM, sin servicios externos, sin PII de terceros.
 *
 * La función devuelve `{ asunto, cuerpo }` listos para ser pasados al motor de
 * notificaciones vía `programar()`. El escaping de Markdown evita inyección de
 * identificadores o nombres de contacto con caracteres especiales.
 */

// SPEC-574 (I-357): el rótulo de categoría DERIVA del mapa canónico `CATEGORIAS_LABELS` — este era el
// tercer mapa paralelo de rótulos y, peor, en un correo A UN PADRE sobre un menor de su círculo tenía
// «Happy slapping»/«Stalking» en inglés crudo. Una sola fuente: si un rótulo cambia, cambia acá también.
import { CATEGORIAS_LABELS } from "@/lib/labels";

export interface RenderEmailReporteCirculoInput {
    nombreContacto: string;
    identificador: string;
    plataforma: string;
    categoria: string;
    totalReportes: number;
    urlExpediente: string;
}

export interface RenderEmailReporteCirculoOutput {
    asunto: string;
    cuerpo: string;
}

function escapeMarkdown(text: string): string {
    return text
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\*/g, "\\*")
        .replace(/_/g, "\\_")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

function formatearCategoria(categoria: string): string {
    if (!categoria) return "Categoría en revisión";
    return CATEGORIAS_LABELS[categoria] ?? categoria;
}

function textoReportes(totalReportes: number): string {
    const total = Number.isFinite(totalReportes) && totalReportes >= 0 ? Math.floor(totalReportes) : 0;
    return total === 1 ? "1 reporte registrado" : `${total} reportes registrados`;
}

export function renderizarEmailReporteCirculo(
    input: RenderEmailReporteCirculoInput
): RenderEmailReporteCirculoOutput {
    const nombreRaw = input.nombreContacto?.trim();
    const nombreContacto = nombreRaw || "Un contacto de tu Círculo de Confianza";
    const identificador = input.identificador?.trim() || "";
    const plataforma = input.plataforma?.trim() || "Plataforma no especificada";
    const categoria = formatearCategoria(input.categoria?.trim() ?? "");
    const totalReportes =
        Number.isFinite(input.totalReportes) && input.totalReportes >= 0
            ? Math.floor(input.totalReportes)
            : 0;
    const reportesTexto = textoReportes(totalReportes);
    const urlExpediente = input.urlExpediente?.trim() || "";

    const asunto = `Alerta relacionada con ${escapeMarkdown(nombreContacto)}`;

    const lineas: string[] = [
        "Hola,",
        "",
        `Detectamos una alerta relacionada con **${escapeMarkdown(nombreContacto)}** (${escapeMarkdown(identificador)}) en **${escapeMarkdown(plataforma)}**.`,
        "",
        `- Categoría: ${escapeMarkdown(categoria)}`,
        `- Total: ${reportesTexto}`,
    ];

    if (urlExpediente) {
        lineas.push("", `[Ver expediente](${urlExpediente})`);
    }

    return { asunto, cuerpo: lineas.join("\n") };
}
