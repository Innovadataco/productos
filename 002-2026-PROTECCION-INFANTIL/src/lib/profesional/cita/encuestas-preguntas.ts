/**
 * SPEC-429 (A-75 · brief §9-bis · aprobadas provisionalmente por Jelkin
 * 03-09 16:1x). Cinco preguntas por lado, todas de opción — un padre que
 * acaba de salir de una sesión difícil no escribe párrafos.
 *
 * Las etiquetas de opción se guardan en `EncuestaCita.r1..r5` como strings
 * literales. La UI muestra `label`; el service compara `key`. Cambiar una
 * `key` es migración de datos; cambiar el `label` no.
 */
export interface OpcionPregunta {
    key: string;
    label: string;
}

export interface DefinicionPregunta {
    id: "r1" | "r2" | "r3" | "r4" | "r5";
    enunciado: string;
    opciones: readonly OpcionPregunta[];
}

/**
 * Preguntas del padre — orden y contenido fijados por §9-bis. r1 y r2 son
 * las que entran al cruce con las del profesional (candado del brief:
 * «el valor no está en la calificación, está en detectar la contradicción»).
 */
export const PREGUNTAS_PADRE: readonly DefinicionPregunta[] = [
    {
        id: "r1",
        enunciado: "¿Se dio la cita?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "NO_NO_SE_PRESENTO", label: "No, no se presentó" },
            { key: "NO_CANCELAMOS", label: "No, la cancelamos" },
        ],
    },
    {
        id: "r2",
        enunciado: "¿Empezó a la hora acordada?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "DEMORA", label: "Con demora" },
            { key: "NO_SE_DIO", label: "No se dio" },
        ],
    },
    {
        id: "r3",
        enunciado: "¿Sentiste que entendió lo que le estaba pasando a tu hijo?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "MAS_O_MENOS", label: "Más o menos" },
            { key: "NO", label: "No" },
        ],
    },
    {
        id: "r4",
        enunciado: "¿Te quedaste con una idea clara de qué hacer ahora?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "EN_PARTE", label: "En parte" },
            { key: "NO", label: "No" },
        ],
    },
    {
        id: "r5",
        enunciado: "¿Volverías con este profesional?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "NO_SE", label: "No sé" },
            { key: "NO", label: "No" },
        ],
    },
] as const;

/**
 * Preguntas del profesional — mismas r1/r2 con la lente del otro lado,
 * más las que miden el mecanismo (r3: ¿sirvió el expediente compartido?
 * r4: ¿la baraja emparejó bien?). Ver §9-bis del brief.
 */
export const PREGUNTAS_PROFESIONAL: readonly DefinicionPregunta[] = [
    {
        id: "r1",
        enunciado: "¿Se dio la cita?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "NO_FAMILIA_NO_SE_PRESENTO", label: "No se presentó la familia" },
            { key: "NO_CANCELAMOS", label: "La cancelamos" },
        ],
    },
    {
        id: "r2",
        enunciado: "¿La familia llegó a tiempo?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "DEMORA", label: "Con demora" },
            { key: "NO_LLEGO", label: "No llegó" },
        ],
    },
    {
        id: "r3",
        enunciado: "¿La información que recibiste antes te sirvió?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "EN_PARTE", label: "En parte" },
            { key: "NO_RECIBI", label: "No recibí nada" },
        ],
    },
    {
        id: "r4",
        enunciado: "¿El caso corresponde a tu especialidad?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "PARCIALMENTE", label: "Parcialmente" },
            { key: "NO", label: "No era para mí" },
        ],
    },
    {
        id: "r5",
        enunciado: "¿Vas a continuar el proceso con esta familia?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "AUN_NO", label: "Aún no se define" },
            { key: "NO", label: "No" },
        ],
    },
] as const;

export function opcionesValidas(preguntas: readonly DefinicionPregunta[], id: DefinicionPregunta["id"]): readonly string[] {
    const p = preguntas.find((q) => q.id === id);
    if (!p) return [];
    return p.opciones.map((o) => o.key);
}
