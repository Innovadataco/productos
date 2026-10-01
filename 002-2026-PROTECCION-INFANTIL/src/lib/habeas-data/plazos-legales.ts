/**
 * SPEC-772 · [NORMA] · Máximos LEGALES de respuesta de habeas data (Ley 1581 de 2012, arts. 14-15).
 *
 * Son CONSTANTES, NO parametrizables: la ley los fija. El valor OPERACIONAL que se prometa por
 * solicitud (`SolicitudHabeasData.plazoDias`) puede ser MENOR —prometer una respuesta más rápida—
 * pero JAMÁS mayor. Ese techo lo clava por arriba, de forma ESTRUCTURAL, el CHECK de la migración
 * `spec772_solicitud_habeas_data` (no un comentario ni un WHERE): la base rechaza un plazoDias > techo.
 *
 * Este archivo es la FUENTE ÚNICA del techo para el código (el servicio de SPEC-772 parte 1, Dev-1,
 * lo usa para fijar el plazo por defecto). Los mismos valores están hardcodeados en el CHECK; el
 * candado `solicitud-habeas-data-datos.candado.test.ts` los fija (si alguien los sube, cambió la ley,
 * no el código) y prueba, además, que el CHECK rechaza todo plazo por encima del techo.
 */
import type { TipoSolicitudHabeasData } from "@prisma/client";

/** [NORMA] Ley 1581 art. 14 · consulta: 10 días hábiles. */
export const PLAZO_MAX_CONSULTA_DIAS_HABILES = 10;

/** [NORMA] Ley 1581 art. 15 · reclamo (rectificación/supresión): 15 días hábiles. */
export const PLAZO_MAX_RECLAMO_DIAS_HABILES = 15;

/** El techo LEGAL en días hábiles según el tipo de solicitud. Un plazo operacional nunca puede
 *  superarlo (lo enforce la base; esto es la fuente para fijar el default por debajo del techo).
 *
 *  SPEC-798 · EXHAUSTIVA a propósito (no un ternario): un derecho NUEVO no puede heredar un plazo por
 *  el `else`. Si se agrega un valor a `TipoSolicitudHabeasData` y no se le fija techo acá, el
 *  `const _exhaustivo: never = tipo` del default NO COMPILA — alguien tiene que decidir el plazo, no
 *  la omisión. (Era el patrón de I-434: un plazo legal decidido por el `else` de un ternario.) */
export function plazoMaximoLegalDiasHabiles(tipo: TipoSolicitudHabeasData): number {
    switch (tipo) {
        case "CONSULTA":
            return PLAZO_MAX_CONSULTA_DIAS_HABILES;
        case "RECTIFICACION":
        case "SUPRESION":
        // SPEC-798 · REVOCACION toma el techo del «reclamo» (art. 15) HEREDADO de SUPRESION: hoy una
        // revocación se archivaría como SUPRESION, ya con techo 15. 798 tipifica, NO determina plazo nuevo.
        case "REVOCACION":
            return PLAZO_MAX_RECLAMO_DIAS_HABILES;
        default: {
            const _exhaustivo: never = tipo;
            throw new Error(
                `[plazos-legales] TipoSolicitudHabeasData sin techo legal fijado: ${String(_exhaustivo)}. ` +
                    "Un derecho nuevo no hereda un plazo por omisión — fijalo acá y en el CHECK de la migración.",
            );
        }
    }
}
