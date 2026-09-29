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
    // SPEC-783: las credenciales viven bajo `_sensibles` (sub-objeto reservado) para que el
    // estado terminal las borre de un golpe, sin lista de nombres. Se APLANAN acá —único punto
    // de render que usan envío, bandeja y reenvío— para que `{{tempPassword}}` resuelva mientras
    // `_sensibles` exista. Tras la limpieza terminal, `_sensibles` ya no está y el token queda vacío.
    const sensibles = (variables._sensibles ?? {}) as Record<string, unknown>;
    const vars = { ...variables, ...sensibles };
    return {
        asunto: asunto ? renderTemplate(asunto, vars) : null,
        cuerpo: renderTemplate(cuerpoMarkdown, vars),
    };
}
