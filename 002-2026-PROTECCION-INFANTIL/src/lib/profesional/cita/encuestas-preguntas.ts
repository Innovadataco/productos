/**
 * SPEC-753 · Las preguntas de la encuesta de servicio de la sesión.
 *
 * Texto EXACTO de `LEGAL/ENCUESTA-SERVICIO-SESION-v0.1` (REPORTE-069). Reemplaza
 * por completo la versión de #429, que era PRE-069 y violaba las decisiones
 * 18/20/21 (preguntas clínicas, una razón con culpa, y preguntas distintas por
 * lado). Acá:
 *  - Las 5 preguntas son IDÉNTICAS para el padre y para el profesional, y las 5
 *    CRUZAN — mismo hecho de servicio observable por ambos.
 *  - [NORMA] son de SERVICIO, nunca de calidad ni resultado clínico (dato
 *    sensible del menor, Ley 1581; secreto profesional, Ley 1090).
 *  - Sin puntaje (decisión 22) y sin texto libre: «Otra» NO abre un cuadro.
 *
 * Las `key` de cada opción son los valores cerrados que la BD guarda. Q1 mapea a
 * `EncuestaCita.seRealizo` (Boolean); Q2–Q5 y las razones mapean a los enums de
 * Prisma (OperadorConvoco, InicioSesion, EnlaceFunciono, DuracionSesion,
 * RazonNoSesion). Este módulo NO importa `@prisma/client`: el service —ya con el
 * esquema en `main`— ata estas keys a los enums con un candado de PARIDAD.
 * Cambiar una `key` es migración de datos; cambiar un `label` no.
 */

export interface OpcionPregunta {
    readonly key: string;
    readonly label: string;
}

/** Las 5 preguntas que cruzan. `pregunta` = valor del enum PreguntaEncuesta. */
export type ClavePregunta = "SE_REALIZO" | "OPERADOR" | "INICIO" | "ENLACE" | "DURACION";

export interface DefinicionPregunta {
    readonly pregunta: ClavePregunta;
    readonly enunciado: string;
    readonly opciones: readonly OpcionPregunta[];
}

/**
 * Las 5 preguntas de servicio, en orden, idénticas para ambos lados. Q1 se
 * guarda como Boolean (`SI`→true, `NO`→false); el resto como su enum.
 */
export const PREGUNTAS_SERVICIO: readonly DefinicionPregunta[] = [
    {
        pregunta: "SE_REALIZO",
        enunciado: "¿Se realizó la sesión?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "NO", label: "No" },
        ],
    },
    {
        pregunta: "OPERADOR",
        enunciado: "¿El operador abrió la reunión, la presentó y se retiró?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "NO", label: "No" },
            { key: "NO_HUBO_OPERADOR", label: "No hubo operador" },
        ],
    },
    {
        pregunta: "INICIO",
        enunciado: "¿La sesión comenzó a la hora acordada?",
        opciones: [
            { key: "A_TIEMPO", label: "Sí" },
            { key: "CON_RETRASO", label: "Con retraso" },
            { key: "NO_COMENZO", label: "No comenzó" },
        ],
    },
    {
        pregunta: "ENLACE",
        enunciado: "¿El enlace / la videollamada funcionó?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "CON_PROBLEMAS", label: "Con problemas" },
            { key: "NO_FUNCIONO", label: "No funcionó" },
        ],
    },
    {
        pregunta: "DURACION",
        enunciado: "¿Cuánto duró aproximadamente?",
        opciones: [
            { key: "MENOS_15", label: "Menos de 15 min" },
            { key: "ENTRE_15_30", label: "15–30 min" },
            { key: "ENTRE_30_45", label: "30–45 min" },
            { key: "MAS_45", label: "Más de 45 min" },
        ],
    },
] as const;

/**
 * Razones cerradas del «No se realizó» (solo si Q1 = No). NEUTRAS y de EVENTO:
 * ninguna nombra ni culpa a una parte, por eso sirven desde los dos lados
 * (decisión 21). [NORMA] «Otra» NO abre texto libre — si hace falta elaborar, va
 * a soporte/PQR, fuera de este registro.
 */
export const RAZONES_NO_REALIZO: readonly OpcionPregunta[] = [
    { key: "NO_ME_CONECTE", label: "No logré conectarme yo" },
    { key: "OTRA_PARTE_NO_CONECTO", label: "La otra parte no se conectó" },
    { key: "PROBLEMA_TECNICO", label: "Problema técnico (enlace, video o audio)" },
    { key: "OTRA", label: "Otra" },
] as const;

/** Las keys válidas de una pregunta (para validar lo que llega, cerrado). */
export function opcionesValidas(pregunta: ClavePregunta): readonly string[] {
    const def = PREGUNTAS_SERVICIO.find((p) => p.pregunta === pregunta);
    return def ? def.opciones.map((o) => o.key) : [];
}

/**
 * Etiqueta legible de un valor cerrado (para el rótulo del incidente, que se
 * RENDERIZA de valores cerrados, nunca se persiste como texto). Devuelve la
 * `key` misma si no hay etiqueta — nunca inventa texto.
 */
export function etiquetaOpcion(pregunta: ClavePregunta, key: string): string {
    const def = PREGUNTAS_SERVICIO.find((p) => p.pregunta === pregunta);
    return def?.opciones.find((o) => o.key === key)?.label ?? key;
}
