import { llamarOllama, type OllamaMetrics } from "./ollama-client";

export interface AnonimizacionResult {
    textoAnonimizado: string;
    piiDetectada: string[];
    metrics: OllamaMetrics;
}

const SYSTEM_PROMPT = `Eres un asistente especializado en protección de datos personales de menores.
Recibirás un texto de reporte comunitario. Tu tarea es:

1. Identificar datos personales identificables (PII) de menores o terceros inocentes: nombres propios, nombres de colegios/instituciones, direcciones, nombres de familiares directos.
2. NO anonimizar el identificador del reportado (número telefónico, nick o usuario de plataforma) si aparece en el texto.
3. Reemplazar cada PII detectada por una etiqueta genérica como [NOMBRE], [COLEGIO], [DIRECCIÓN], [FAMILIAR].
4. Mantener el sentido original del texto, la longitud mínima de 20 caracteres y la coherencia.
5. Responder ÚNICAMENTE con un JSON válido de esta forma exacta:

{
  "texto_anonimizado": "texto con etiquetas",
  "pii_detectada": ["fragmento1", "fragmento2"]
}

Si no detectas PII, devuelve el texto original sin cambios y una lista vacía.`;

export async function anonimizarTexto(modelo: string, texto: string): Promise<AnonimizacionResult> {
    const { response, metrics } = await llamarOllama(modelo, `Texto del reporte: "${texto}"`, SYSTEM_PROMPT);

    let parsed: { texto_anonimizado?: string; pii_detectada?: unknown };
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response;
        parsed = JSON.parse(jsonStr);
    } catch {
        console.error("[ANONIMIZADOR] No se pudo parsear JSON de Ollama. responseLen=", response.length);
        throw new Error("Respuesta inválida del modelo de anonimización");
    }

    const textoAnonimizado = String(parsed.texto_anonimizado || texto).trim();
    const piiDetectada = Array.isArray(parsed.pii_detectada)
        ? parsed.pii_detectada.map(String)
        : [];

    if (textoAnonimizado.length < 20) {
        throw new Error("Texto anonimizado demasiado corto");
    }

    return { textoAnonimizado, piiDetectada, metrics };
}
