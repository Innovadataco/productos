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
 *  superarlo (lo enforce la base; esto es la fuente para fijar el default por debajo del techo). */
export function plazoMaximoLegalDiasHabiles(tipo: TipoSolicitudHabeasData): number {
    return tipo === "CONSULTA" ? PLAZO_MAX_CONSULTA_DIAS_HABILES : PLAZO_MAX_RECLAMO_DIAS_HABILES;
}
