/**
 * SPEC-813 · Clasificación del estado REPS para el AVISO al profesional y la alarma de ADMIN.
 *
 * `¬repsAlDia` (la negación de `repsElegible(..., modalidad=null)`) **funde CUATRO causas distintas**
 * —medido en la tabla de readiness de SPEC-813—: no es un estado, es la ausencia de varias cosas a la
 * vez. El aviso al profesional SOLO debe salir cuando su habilitación REPS **caducó de verdad**. Las
 * causas que son NUESTRAS (nuestro re-chequeo venció) o de otra naturaleza (no se lo encontró, borde sin
 * fecha) van a una alarma de ADMIN, nunca al profesional: decirle «renueve en el registro oficial»
 * cuando la autoridad lo sigue dando por vigente es **culparlo de nuestra desactualización** y además un
 * **callejón** —la acción es del admin, no suya—.
 *
 * Discrimina por el HECHO + los RELOJES, **no por el `motivo` string**: los estados 6, 7 y 8 comparten
 * `estado=VIGENTE` y sólo difieren en los relojes; clasificar por el texto del motivo sería una lista a
 * mano que envejece con el primer motivo que nadie anticipó (misma razón por la que el motor derivó
 * siempre del HECHO y no de una columna cacheada).
 *
 * Es **vigencia-only** (sin modalidad), igual que `repsAlDia` en el directorio: la cobertura por
 * modalidad se exige en la compuerta de RESERVA (`esRepsElegibleParaModalidad`), donde el padre no puede
 * reservar lo que no está cubierto — no en un banner informativo (SPEC-813, decisión 3).
 *
 * PURA · fail-closed · `now` inyectado (sin reloj de pared). Mapa de los 8 estados medidos:
 *   1 sin fila · 2 `SIN_VERIFICAR`                         → `SIN_VERIFICAR`  (nunca «caducado»: no hay verificación)
 *   3 `VIGENTE`, los dos relojes OK                        → `AL_DIA`
 *   4 `VENCIDA` · 6 `VIGENTE` + `vigenteHasta ≤ now`       → `CADUCADO`       (aviso al profesional)
 *   5 `NO_ENCONTRADA` · 7 nuestro re-chequeo > ventana ·
 *   8 `VIGENTE` sin `vigenteHasta`                         → `REVISION_ADMIN` (alarma de admin, NO al profesional)
 *
 * El 8 es **inconstruible en la base**: el CHECK VALIDADO `VerificacionReps_vigente_exige_vigencia_check`
 * (#792 / D-121 de Datos) rechaza un `VIGENTE` sin `vigenteHasta`. Se clasifica igual por defensa en
 * profundidad (fail-closed), pero la base no lo produce.
 */
import type { HechoReps, ConfigReps } from "./reps-elegibilidad";

const DIA_MS = 24 * 60 * 60 * 1000;

const esFecha = (d: Date | null | undefined): d is Date => d instanceof Date && Number.isFinite(d.getTime());

/**
 * Las categorías del aviso. Cerrado a propósito (como `ESTADOS_REPS`): el candado y el `switch`
 * exhaustivo cazan un valor nuevo en vez de confiar en una lista escrita a mano.
 */
export const CLASIFICACIONES_AVISO_REPS = ["AL_DIA", "SIN_VERIFICAR", "CADUCADO", "REVISION_ADMIN"] as const;
export type ClasificacionAvisoReps = (typeof CLASIFICACIONES_AVISO_REPS)[number];

/**
 * Clasifica el HECHO REPS vigente (la ÚLTIMA fila, o `null` si no hay) en la causa que el aviso necesita.
 * Vigencia-only (sin modalidad). Fail-closed: ante la duda, nunca «caducado» (eso culpa al profesional).
 */
export function clasificarAvisoReps(hecho: HechoReps | null, config: ConfigReps, now: Date): ClasificacionAvisoReps {
    // Reloj inválido: condición interna, no un estado del profesional. NO es un 9º estado —es el guardia
    // de entrada, igual que en `repsElegible`—. Fail-closed hacia el admin: nunca le decimos «caducado».
    if (!esFecha(now)) return "REVISION_ADMIN";
    // 1 · sin fila: nunca se cargó una verificación → «sin verificar», jamás «caducado».
    if (!hecho) return "SIN_VERIFICAR";

    switch (hecho.resultado) {
        case "SIN_VERIFICAR": // 2 · se registró explícitamente «sin verificar» (fuente caída, etc.).
            return "SIN_VERIFICAR";
        case "VENCIDA": // 4 · estuvo habilitado y la inscripción venció → caducó de verdad.
            return "CADUCADO";
        case "NO_ENCONTRADA": // 5 · lo buscamos y no está: no es un trámite vencido, es revisión nuestra.
            return "REVISION_ADMIN";
        case "VIGENTE": {
            // 8 · `VIGENTE` sin fecha de autoridad: borde inconstruible por el CHECK VALIDADO de la
            // migración. Defensa en profundidad fail-closed → admin (no se le escribe copy al profesional).
            if (!esFecha(hecho.vigenteHasta)) return "REVISION_ADMIN";
            // 6 · la vigencia de la AUTORIDAD ya pasó → caducó de verdad → aviso al profesional.
            if (hecho.vigenteHasta.getTime() <= now.getTime()) return "CADUCADO";
            // 7 · la autoridad SIGUE vigente, pero NUESTRO re-chequeo envejeció más allá de la ventana →
            // la acción es del admin (re-verificar), no del profesional → alarma de admin, no aviso.
            const limiteNuestro = (esFecha(hecho.verificadoEn) ? hecho.verificadoEn.getTime() : -Infinity) + config.ventanaVerificacionDias * DIA_MS;
            if (limiteNuestro <= now.getTime()) return "REVISION_ADMIN";
            // 3 · los dos relojes OK → al día (ofrecible por vigencia; la modalidad se exige al reservar).
            return "AL_DIA";
        }
        default: {
            // Exhaustividad: un `EstadoReps` nuevo (un 5º valor) rompe `tsc` acá A PROPÓSITO — obliga a
            // decidir su clasificación en vez de caer en un silencio (el «PARÁ ante un 9º estado» de SPEC-813,
            // hecho imposibilidad de compilación). En runtime, fail-closed hacia el admin.
            const _exhaustivo: never = hecho.resultado;
            void _exhaustivo;
            return "REVISION_ADMIN";
        }
    }
}

/**
 * El aviso al PROFESIONAL sale SOLO con el estado caducado EXPLÍCITO (4 y 6), nunca con `¬repsAlDia`
 * crudo. Robusto al cierre del cutover: cuando `exigirRepsVerificado` pase a `true`, los estados 1 y 2
 * saldrán de la oferta pero NO dispararán este aviso —«sin verificar» no es «caducado»—.
 */
export function debeMostrarAvisoCaducadoReps(hecho: HechoReps | null, config: ConfigReps, now: Date): boolean {
    return clasificarAvisoReps(hecho, config, now) === "CADUCADO";
}

/**
 * Los estados que van a la alarma de ADMIN (5, 7, 8): excluirlos del aviso al profesional NO es
 * silenciarlos — llegan a la superficie de admin, no al profesional, que no puede resolverlos.
 */
export function requiereRevisionAdminReps(hecho: HechoReps | null, config: ConfigReps, now: Date): boolean {
    return clasificarAvisoReps(hecho, config, now) === "REVISION_ADMIN";
}
