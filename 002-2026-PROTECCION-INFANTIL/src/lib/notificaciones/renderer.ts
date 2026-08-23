/**
 * SPEC-201 (BRIEF §5.2): render simple de plantillas Markdown con variables
 * tipo `{{nombre}}`. No se implementa un motor de plantillas pesado: reemplazo
 * literal de tokens.
 */
export interface RenderResult {
    asunto: string | null;
    cuerpo: string;
}

function renderTemplate(plantilla: string, variables: Record<string, unknown>): string {
    return plantilla.replace(/\{\{(\s*[a-zA-Z0-9_.-]+\s*)\}\}/g, (_match, clave) => {
        const trimmed = clave.trim();
        const valor = variables[trimmed];
        if (valor === undefined || valor === null) return "";
        return String(valor);
    });
}

export function renderizarPlantilla(
    cuerpoMarkdown: string,
    asunto: string | null,
    variables: Record<string, unknown>
): RenderResult {
    return {
        asunto: asunto ? renderTemplate(asunto, variables) : null,
        cuerpo: renderTemplate(cuerpoMarkdown, variables),
    };
}
