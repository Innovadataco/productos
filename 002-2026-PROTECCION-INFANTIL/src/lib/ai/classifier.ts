import { llamarOllama, type OllamaMetrics } from "./ollama-client";

type CategoriaConducta =
    | "CONTACTO_INSISTENTE"
    | "SOLICITUD_MATERIAL"
    | "OFRECIMIENTO_REGALOS"
    | "SUPLANTACION_IDENTIDAD"
    | "SOLICITUD_ENCUENTRO"
    | "COMPARTIMIENTO_SEXUAL"
    | "OTRO";

type EstadoReporte =
    | "PENDIENTE"
    | "PROCESANDO"
    | "CLASIFICADO"
    | "REVISION_MANUAL"
    | "POSIBLE_SPAM"
    | "DUPLICADO"
    | "REQUIERE_ANONIMIZACION"
    | "CORREGIDO";

const CATEGORIAS_VALIDAS: CategoriaConducta[] = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
];

interface ClassificationResult {
    categoria: CategoriaConducta;
    confianza: number;
    contienePii: boolean;
    piiDetectada: string[];
    estado: EstadoReporte;
    rawResponse: string;
    metrics: OllamaMetrics;
}

const SYSTEM_PROMPT = `Eres un clasificador especializado en protección infantil. Analiza el texto proporcionado y responde ÚNICAMENTE en formato JSON válido con esta estructura exacta:

{
  "categoria": "CONTACTO_INSISTENTE|SOLICITUD_MATERIAL|OFRECIMIENTO_REGALOS|SUPLANTACION_IDENTIDAD|SOLICITUD_ENCUENTRO|COMPARTIMIENTO_SEXUAL|OTRO",
  "confianza": 0.0-1.0,
  "contiene_pii": true|false,
  "pii_detectada": ["fragmento1", "fragmento2"]
}

Categorías:
- CONTACTO_INSISTENTE: contacto repetido e incómodo
- SOLICITUD_MATERIAL: solicitud de fotos/videos íntimos
- OFRECIMIENTO_REGALOS: ofrecimiento de dinero, regalos o beneficios
- SUPLANTACION_IDENTIDAD: fingir ser menor, familiar o figura de autoridad
- SOLICITUD_ENCUENTRO: solicitud de reunión física
- COMPARTIMIENTO_SEXUAL: envío o solicitud de contenido sexual
- OTRO: conducta real que no encaja en las anteriores

PII = datos personales identificables de menores (nombres propios, nombres de escuelas, direcciones, nombres de familiares). No incluyas el número telefónico o nick del agresor como PII.

Si el texto es ambiguo, incompleto o no puedes clasificar con confianza, usa categoria "OTRO" y confianza baja (< 0.5).

Responde SOLO el JSON, sin markdown, sin explicaciones.`;

export async function clasificarReporte(
    modelo: string,
    texto: string
): Promise<ClassificationResult> {
    const userPrompt = `Texto del reporte: "${texto}"`;

    const { response, metrics } = await llamarOllama(modelo, userPrompt, SYSTEM_PROMPT);

    let parsed: Record<string, unknown>;
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : response;
        parsed = JSON.parse(jsonStr);
    } catch {
        console.error("[CLASSIFIER] No se pudo parsear JSON de Ollama. responseLen=", response.length);
        return fallbackResult(response, metrics);
    }

    const categoria = parseCategoria(String(parsed.categoria || "OTRO"));
    const confianza = clamp(Number(parsed.confianza) || 0, 0, 1);
    const contienePii = Boolean(parsed.contiene_pii);
    const piiDetectada = Array.isArray(parsed.pii_detectada)
        ? parsed.pii_detectada.map(String)
        : [];

    const estado: EstadoReporte = determineEstado(confianza, contienePii);

    return {
        categoria,
        confianza,
        contienePii,
        piiDetectada,
        estado,
        rawResponse: response,
        metrics,
    };
}

function parseCategoria(raw: string): CategoriaConducta {
    const normalized = raw.toUpperCase().trim();
    if (CATEGORIAS_VALIDAS.includes(normalized as CategoriaConducta)) {
        return normalized as CategoriaConducta;
    }
    return "OTRO";
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(Math.max(n, min), max);
}

function determineEstado(confianza: number, contienePii: boolean): EstadoReporte {
    if (contienePii) return "REQUIERE_ANONIMIZACION";
    if (confianza < 0.5) return "REVISION_MANUAL";
    return "CLASIFICADO";
}

function fallbackResult(rawResponse: string, metrics: OllamaMetrics): ClassificationResult {
    return {
        categoria: "OTRO",
        confianza: 0,
        contienePii: false,
        piiDetectada: [],
        estado: "REVISION_MANUAL",
        rawResponse,
        metrics,
    };
}