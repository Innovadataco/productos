/**
 * SPEC-784 · Las preguntas de la encuesta de servicio de la sesión — copy de DISEÑO.
 *
 * Fuente ÚNICA de la palabra visible (D-3, veredicto CEO): la da Diseño en
 * `FORMA-SPEC784-FORMULARIO-ENCUESTA-CITA-2026-09-29.md` (commit `d682cdb`). Reemplaza la redacción
 * previa (texto legal v0.1 de REPORTE-069, que era BORRADOR [ABOGADO]-pendiente y NO estaba marcado
 * `[NORMA]` en su redacción). Como el módulo NO tenía consumidor de producción, no había dos copys
 * vivos: había uno muerto (este) y uno vivo (Diseño). No se agrega una segunda capa — se actualiza acá.
 *
 * Lo que NO cambia (y el candado lo vigila): las `key` son los valores cerrados que la BD guarda
 * (Q1→`seRealizo` Boolean; el resto → enums de Prisma), y las 5 preguntas son IDÉNTICAS para el padre
 * y el profesional (o el cruce compara con varas distintas). Cambiar una `key` es migración de datos;
 * cambiar un `label` es autoridad de Diseño.
 *
 * `[NORMA]` (conducta, no redacción — el candado lo vigila por MORFOLOGÍA, no por lista de frases):
 *  - Las preguntas son de SERVICIO (que la sesión ocurriera como se acordó), NUNCA de calidad ni de
 *    resultado clínico — eso sería dato sensible del menor (Ley 1581) y rozaría el secreto profesional
 *    (Ley 1090). Ninguna pregunta pide el estado del menor, lo que se habló, ni síntomas.
 *  - «Otra» es una opción CERRADA — no abre un cuadro de texto. Cero texto libre en todo el formulario.
 *
 * Voz (tú padre / usted profesional), intro y desenlace del «no se realizó» viven en el FORMULARIO
 * (no son copy por-pregunta). Acá vive la única palabra que cambia POR AUDIENCIA sin cambiar el hecho:
 * el label role-relative de `OTRA_PARTE_NO_CONECTO` (eje de audiencia, no un módulo duplicado).
 *
 * Este módulo NO importa `@prisma/client`: el candado de PARIDAD (`encuestas-preguntas-enums.candado`)
 * ata estas `key` a los enums.
 */

/** Las dos sillas desde las que se responde la MISMA encuesta (= `OrigenEncuestaCita`, sin importar Prisma). */
export type Audiencia = "PADRE" | "PROFESIONAL";

export interface OpcionPregunta {
    readonly key: string;
    /** Label por defecto / audiencia-neutro (lo usa el rótulo del incidente, que no tiene silla). */
    readonly label: string;
    /**
     * Override role-relative: el MISMO hecho leído desde cada silla. Sólo lo usa la opción cuyo enum es
     * simétrico («la otra parte»); el resto de las opciones son iguales para ambos y no lo llevan.
     */
    readonly labelPorAudiencia?: Readonly<Record<Audiencia, string>>;
}

/** Las 5 preguntas que cruzan. `pregunta` = valor del enum PreguntaEncuesta. */
export type ClavePregunta = "SE_REALIZO" | "OPERADOR" | "INICIO" | "ENLACE" | "DURACION";

export interface DefinicionPregunta {
    readonly pregunta: ClavePregunta;
    readonly enunciado: string;
    readonly opciones: readonly OpcionPregunta[];
}

/**
 * Las 5 preguntas de servicio, en orden, idénticas para ambos lados. Q1 se guarda como Boolean
 * (`SI`→true, `NO`→false); el resto como su enum. Q3/Q4/Q5 aparecen SIEMPRE (sus valores «no hubo /
 * no comenzó / no funcionó» son respuestas); la duración es condicional (sólo si Q1 = Sí).
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
        enunciado: "¿El operador abrió la reunión?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "NO", label: "No" },
            { key: "NO_HUBO_OPERADOR", label: "No hubo operador" },
        ],
    },
    {
        pregunta: "INICIO",
        enunciado: "¿La sesión comenzó?",
        opciones: [
            { key: "A_TIEMPO", label: "Sí, a tiempo" },
            { key: "CON_RETRASO", label: "Sí, con retraso" },
            { key: "NO_COMENZO", label: "No comenzó" },
        ],
    },
    {
        pregunta: "ENLACE",
        enunciado: "¿El enlace funcionó?",
        opciones: [
            { key: "SI", label: "Sí" },
            { key: "CON_PROBLEMAS", label: "Con problemas" },
            { key: "NO_FUNCIONO", label: "No funcionó" },
        ],
    },
    {
        pregunta: "DURACION",
        enunciado: "¿Cuánto duró?",
        opciones: [
            { key: "MENOS_15", label: "Menos de 15 minutos" },
            { key: "ENTRE_15_30", label: "Entre 15 y 30 minutos" },
            { key: "ENTRE_30_45", label: "Entre 30 y 45 minutos" },
            { key: "MAS_45", label: "Más de 45 minutos" },
        ],
    },
] as const;

/** Enunciado de la pregunta condicional de la razón (sólo si Q1 = No). */
export const RAZON_NO_REALIZO_ENUNCIADO = "¿Qué pasó?";

/**
 * Razones cerradas del «No se realizó» (sólo si Q1 = No). De EVENTO, no de culpa nombrada — por eso el
 * cruce funciona desde los dos lados. `OTRA_PARTE_NO_CONECTO` es la ÚNICA role-relative: el enum dice
 * «la otra parte»; cada silla la nombra (el profesional / la familia), mismo hecho, cruza igual.
 * `OTRA` es una opción cerrada — NO abre texto libre.
 */
export const RAZONES_NO_REALIZO: readonly OpcionPregunta[] = [
    { key: "NO_ME_CONECTE", label: "No pude conectarme" },
    {
        key: "OTRA_PARTE_NO_CONECTO",
        label: "La otra parte no se conectó",
        labelPorAudiencia: {
            PADRE: "El profesional no se conectó",
            PROFESIONAL: "La familia no se conectó",
        },
    },
    { key: "PROBLEMA_TECNICO", label: "Hubo un problema técnico" },
    { key: "OTRA", label: "Otra razón" },
] as const;

/** El label de una opción para una audiencia: el override role-relative si existe, si no el neutro. */
export function labelOpcion(opcion: OpcionPregunta, audiencia: Audiencia): string {
    return opcion.labelPorAudiencia?.[audiencia] ?? opcion.label;
}

/** Las keys válidas de una pregunta (para validar lo que llega, cerrado). */
export function opcionesValidas(pregunta: ClavePregunta): readonly string[] {
    const def = PREGUNTAS_SERVICIO.find((p) => p.pregunta === pregunta);
    return def ? def.opciones.map((o) => o.key) : [];
}

/**
 * Etiqueta legible de un valor cerrado (para el rótulo del incidente, que se RENDERIZA de valores
 * cerrados, nunca se persiste como texto). Devuelve la `key` misma si no hay etiqueta — nunca inventa
 * texto. Neutro por defecto; con `audiencia` resuelve el label role-relative.
 */
export function etiquetaOpcion(pregunta: ClavePregunta, key: string, audiencia?: Audiencia): string {
    const def = PREGUNTAS_SERVICIO.find((p) => p.pregunta === pregunta);
    const opcion = def?.opciones.find((o) => o.key === key);
    if (!opcion) return key;
    return audiencia ? labelOpcion(opcion, audiencia) : opcion.label;
}
