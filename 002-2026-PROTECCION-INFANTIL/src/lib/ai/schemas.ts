/**
 * JSON Schemas para structured outputs de Ollama.
 *
 * Estos schemas se envían en el campo `format` de `/api/generate` para forzar
 * al modelo a devolver JSON válido y estructurado sin depender de parseo manual.
 */

const CATEGORIAS_VALIDAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
    "OTRO",
] as const;

export const classificationResponseSchema = {
    type: "object",
    properties: {
        categoria: {
            type: "string",
            enum: [...CATEGORIAS_VALIDAS],
            description: "Categoría principal de la conducta de riesgo descrita en el texto.",
        },
        confianza: {
            type: "number",
            minimum: 0,
            maximum: 1,
            description: "Confianza de la clasificación entre 0.0 y 1.0.",
        },
        posible_agresor_par: {
            type: "boolean",
            description:
                "True si el posible agresor parece ser otro adolescente, compañero de escuela, amigo de la edad o par del entorno cercano del NNA.",
        },
    },
    required: ["categoria", "confianza", "posible_agresor_par"],
    additionalProperties: false,
};

export interface ClassificationResponse {
    categoria: (typeof CATEGORIAS_VALIDAS)[number];
    confianza: number;
    posible_agresor_par: boolean;
}

export const anonimizacionResponseSchema = {
    type: "object",
    properties: {
        texto_anonimizado: {
            type: "string",
            minLength: 20,
            description: "Texto del reporte con datos personales reemplazados por etiquetas genéricas.",
        },
        pii_detectada: {
            type: "array",
            items: { type: "string" },
            description: "Lista de fragmentos de PII detectados. Vacía si no hay PII.",
        },
    },
    required: ["texto_anonimizado", "pii_detectada"],
    additionalProperties: false,
};

export interface AnonimizacionResponse {
    texto_anonimizado: string;
    pii_detectada: string[];
}
