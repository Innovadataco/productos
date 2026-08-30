/**
 * SPEC-308 (A-50): renderizado puro del email enriquecido de alerta del
 * Círculo de Confianza. Sin LLM, sin servicios externos, sin PII de terceros.
 *
 * La función devuelve `{ asunto, cuerpo }` listos para ser pasados al motor de
 * notificaciones vía `programar()`. El escaping de Markdown evita inyección de
 * identificadores o nombres de contacto con caracteres especiales.
 */

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

const CATEGORIA_ETIQUETA: Record<string, string> = {
    CONTACTO_INSISTENTE: "Contacto insistente",
    SOLICITUD_MATERIAL: "Solicitud de material",
    OFRECIMIENTO_REGALOS: "Ofrecimiento de regalos",
    SUPLANTACION_IDENTIDAD: "Suplantación de identidad",
    SOLICITUD_ENCUENTRO: "Solicitud de encuentro",
    COMPARTIMIENTO_SEXUAL: "Compartimiento sexual",
    OTRO: "Otro",
    EXTORSION: "Extorsión",
    CONTENIDO_GENERADO_IA: "Contenido generado por IA",
    DIFUSION_NO_CONSENTIDA: "Difusión no consentida",
    DOXING: "Doxing",
    SPAM: "Spam",
    CIBERACOSO: "Ciberacoso",
    HAPPY_SLAPPING: "Happy slapping",
    STALKING: "Stalking",
};

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
    return CATEGORIA_ETIQUETA[categoria] ?? categoria;
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
