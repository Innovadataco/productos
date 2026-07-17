import { llamarOllamaStructured } from "./ollama-client";
import { detectarPiiDeterministico } from "./pii-patterns";
import { anonimizacionResponseSchema, type AnonimizacionResponse } from "./schemas";

export interface PiiDetectionResult {
    contienePii: boolean;
    contienePiiDeterministico: boolean;
    contienePiiLLM: boolean;
    piiDetectada: string[];
    piiDetectadaDeterministica: string[];
    piiDetectadaLLM: string[];
    metrics: {
        modelo: string;
        latenciaMs: number;
        promptTokens: number | null;
        responseTokens: number | null;
    };
    rawResponse: string;
}

const SYSTEM_PROMPT_PII = `Eres un asistente especializado en protección de datos personales de menores.
Analiza el texto del reporte comunitario y responde con el JSON estructurado solicitado.

Reglas de negocio estrictas:
1. PII de menores o terceros inocentes: nombres propios en contexto familiar/escolar, nombres de colegios/instituciones, direcciones, teléfonos personales del menor, datos escolares identificables.
2. NO es PII:
   - El número telefónico, nick o usuario de la plataforma del AGRESOR (es el identificador reportado).
   - El nombre del adulto agresor.
   - Palabras sueltas como "mamá", "papá", "profesor", "profesora" sin un identificador concreto adyacente.
   - "su número" cuando "su" pueda referirse al agresor.
   - Direcciones genéricas sin dirección concreta: "calle principal", "cerca del colegio".
3. Contextos válidos para teléfono del NNA: "mi celular/es/número", "el celular de mi hijo/hija/sobrino/...", "el número del niño/niña/adolescente", "mi hijo/hija... su celular/número".
4. Una dirección colombiana (calle/carrera/av/diagonal/transversal + números) es PII si podría identificar el hogar o escuela de un menor.
5. Si no hay PII, devuelve texto original sin cambios y lista vacía.

Ejemplos negativos (NO son PII):
- "El señor Carlos Pérez me contactó por WhatsApp" -> []
- "Me contacta un tipo desde el número 3004445566" -> []
- "El usuario @depredador_22 con número 3007654321 escribe todos los días a mi hija" -> []
- "El adulto José Martínez envió material sexual a mi sobrina" -> []
- "mi mamá lo vio y me avisó" -> []
- "la profesora dijo que mi hija debe enviarle fotos" -> []
- "Vive en la calle principal cerca del colegio, no sé el nombre exacto" -> []

Ejemplos positivos:
- "Mi hijo Juan estudia en el colegio San José" -> ["Juan", "colegio San José"]
- "El menor vive en carrera 45 # 12-34 y su celular es 3001234567" -> ["carrera 45 # 12-34", "3001234567"]

Responde SOLO el JSON, sin markdown, sin explicaciones.`;

function normalizeFragmento(f: string): string {
    return f.toLowerCase().replace(/[.,;:!?]+$/, "").trim();
}

function fusionarFragmentos(deterministicos: string[], llm: string[]): string[] {
    const seen = new Set<string>(deterministicos.map(normalizeFragmento));
    const resultado = [...deterministicos];
    for (const f of llm) {
        const key = normalizeFragmento(f);
        if (!seen.has(key)) {
            seen.add(key);
            resultado.push(f.trim());
        }
    }
    return resultado;
}

/**
 * Detecta PII combinando capa determinística y LLM.
 * La regla de fusión es OR: si cualquiera detecta, contienePii=true.
 */
export async function detectarPiiCombinado(
    modelo: string,
    texto: string
): Promise<PiiDetectionResult> {
    const inicio = Date.now();

    const det = detectarPiiDeterministico(texto);

    const { data, rawResponse, metrics } = await llamarOllamaStructured<AnonimizacionResponse>(
        modelo,
        `Texto del reporte: "${texto}"`,
        anonimizacionResponseSchema,
        SYSTEM_PROMPT_PII
    );

    const piiLLM = Array.isArray(data.pii_detectada) ? data.pii_detectada.map(String) : [];
    const piiUnificada = fusionarFragmentos(det.piiDetectada, piiLLM);

    const contienePiiLLM = piiLLM.length > 0;

    return {
        contienePii: det.contienePii || contienePiiLLM,
        contienePiiDeterministico: det.contienePii,
        contienePiiLLM,
        piiDetectada: piiUnificada,
        piiDetectadaDeterministica: det.piiDetectada,
        piiDetectadaLLM: piiLLM,
        metrics: {
            modelo: metrics.modelo,
            latenciaMs: Date.now() - inicio,
            promptTokens: metrics.promptTokens,
            responseTokens: metrics.responseTokens,
        },
        rawResponse,
    };
}
