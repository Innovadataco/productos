import { llamarOllamaStructured, type OllamaMetrics } from "./ollama-client";
import { anonimizacionResponseSchema, type AnonimizacionResponse } from "./schemas";

export interface AnonimizacionResult {
    textoAnonimizado: string;
    piiDetectada: string[];
    metrics: OllamaMetrics;
}

const SYSTEM_PROMPT = `Eres un asistente especializado en protección de datos personales de menores.
Recibirás un texto de reporte comunitario. Tu tarea es:

1. Identificar datos personales identificables (PII) de menores o terceros inocentes: nombres propios, nombres de colegios/instituciones, direcciones, nombres de familiares directos, teléfonos personales del menor, datos escolares identificables.
2. NO anonimizar el identificador del reportado (número telefónico, nick o usuario de plataforma) si aparece en el texto.
3. Reemplazar cada PII detectada por una etiqueta genérica como [NOMBRE], [COLEGIO], [DIRECCIÓN], [FAMILIAR], [TELEFONO], [INFO_ESCOLAR].
4. Mantener el sentido original del texto, la longitud mínima de 20 caracteres y la coherencia.

Los fragmentos indicados como "ya detectados" deben quedar reemplazados obligatoriamente en el texto final. Puedes añadir más PII si detectas alguno adicional.

Si no detectas PII, devuelve el texto original sin cambios y una lista vacía.

Responde SOLO el JSON, sin markdown, sin explicaciones.`;

function normalizeFragmento(f: string): string {
    return f.toLowerCase().replace(/[.,;:!?]+$/, "").trim();
}

function etiquetaParaFragmento(f: string): string {
    const lower = normalizeFragmento(f);
    if (/\b(?:calle|carrera|avenida|av\.?|diagonal|dg|transversal|tv|transv|crc|cl\.?|cra|cll|kr)\s*\d/i.test(f)) {
        return "[DIRECCION]";
    }
    if (/\b(?:colegio|instituto|escuela|liceo|universidad|sede|gimnasio|academia)\b/i.test(f)) {
        return "[COLEGIO]";
    }
    if (/(?:\+?57\s?)?3\d{2}[\s-]?\d{3}[\s-]?\d{4}|3\d{9}/.test(f)) {
        return "[TELEFONO]";
    }
    if (/\b(?:grado|sal[oó]n)\b/i.test(f)) {
        return "[INFO_ESCOLAR]";
    }
    if (/\b(?:mam[aá]|pap[aá]|t[ií]o|t[ií]a|abuel[oa]|herman[oa]|primo|prima|sobrin[oa]|niet[oa]|hij[oa]|familiar)\b/i.test(f)) {
        return "[FAMILIAR]";
    }
    if (/\p{Lu}/u.test(f)) {
        return "[NOMBRE]";
    }
    return "[PII]";
}

function escaparRegex(literal: string): string {
    return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Reemplaza los fragmentos detectados por etiquetas genéricas usando límites de palabra.
 * Ordena por longitud descendente para evitar reemplazos parciales.
 */
function reemplazarFragmentosObligatorios(texto: string, fragmentos: string[]): { texto: string; reemplazados: string[] } {
    const unicos = Array.from(new Set(fragmentos.map(normalizeFragmento))).filter((f) => f.length > 0);
    const ordenados = unicos
        .map((f) => ({ original: f, source: fragmentos.find((s) => normalizeFragmento(s) === f) || f }))
        .sort((a, b) => b.original.length - a.original.length);

    let resultado = texto;
    const reemplazados: string[] = [];

    for (const { original, source } of ordenados) {
        const regex = new RegExp(`\\b${escaparRegex(original)}\\b`, "giu");
        if (regex.test(resultado)) {
            const etiqueta = etiquetaParaFragmento(source);
            resultado = resultado.replace(regex, etiqueta);
            reemplazados.push(source);
        }
    }

    return { texto: resultado, reemplazados };
}

/**
 * Anonimiza un texto usando los fragmentos detectados como hints obligatorios más
 * una pasada libre del LLM para refinar y detectar PII adicional.
 */
export async function anonimizarTexto(
    modelo: string,
    texto: string,
    piiDetectada: string[] = []
): Promise<AnonimizacionResult> {
    const preAnonimizado = reemplazarFragmentosObligatorios(texto, piiDetectada);

    const { data, metrics } = await llamarOllamaStructured<AnonimizacionResponse>(
        modelo,
        `Texto del reporte: "${preAnonimizado.texto}"\n\nFragmentos de PII ya detectados que deben quedar reemplazados: ${JSON.stringify(preAnonimizado.reemplazados)}`,
        anonimizacionResponseSchema,
        SYSTEM_PROMPT
    );

    let textoAnonimizado = String(data.texto_anonimizado || preAnonimizado.texto).trim();
    const piiLLM = Array.isArray(data.pii_detectada) ? data.pii_detectada.map(String) : [];

    // Sanity: si algún fragmento original sigue presente, forzar su reemplazo.
    const sanity = reemplazarFragmentosObligatorios(textoAnonimizado, piiDetectada);
    textoAnonimizado = sanity.texto;

    if (textoAnonimizado.length < 20) {
        throw new Error("Texto anonimizado demasiado corto");
    }

    const piiFinal = Array.from(new Set([...preAnonimizado.reemplazados, ...piiLLM]));

    return { textoAnonimizado, piiDetectada: piiFinal, metrics };
}
