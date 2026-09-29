/**
 * SPEC-746 · FUENTE ÚNICA del estado EFECTIVO de una cita — el que resulta de
 * contar el paso del tiempo sobre el estado persistido.
 *
 * El defecto raíz: una cita `CONFIRMADA` con franja de AYER seguía diciendo
 * «Cita confirmada» porque toda la interfaz decide sobre `estado` (el valor
 * guardado) sin comparar la franja contra `now`. El estado guardado no cuenta
 * el tiempo; esta función sí.
 *
 * Contrato:
 *  - Derivación PURA. No toca schema, endpoints ni copy. Solo dice qué es la
 *    cita AHORA; el cableado a cada pantalla lo radica el CEO contra la forma.
 *  - `now` es INYECTABLE y PURO: nunca se lee el reloj de pared adentro. Un
 *    `now` (o una franja) ausente/basura FALLA HACIA EL LADO CONSERVADOR
 *    (`PASADA`), NUNCA hacia `PROXIMA` — porque `PROXIMA` seguiría mintiendo
 *    («la cita sigue en pie») y `PASADA` cierra la ventana (esconde el enlace,
 *    dispara la encuesta, dice la verdad en pantalla). El defecto no puede
 *    disfrazarse de éxito.
 *  - «Sin inventar estados que el negocio no tenga»: la fase temporal
 *    (PROXIMA/EN_CURSO/PASADA) se superpone SOLO sobre `CONFIRMADA`, que es el
 *    único estado en el que el paso del tiempo cambia la verdad sin que haya
 *    ocurrido una transición de negocio. Todo otro estado se DEVUELVE tal cual
 *    (passthrough): un `CUMPLIDA`/`NO_ASISTIO_*`/`VENCIDA_SIN_RESPUESTA`/
 *    `REEMBOLSADA`/`REPROGRAMADA` ya es terminal y verdadero; un
 *    `PAGADA_PENDIENTE`/`SIN_CONFIRMAR` lo gobierna OTRO reloj (la ventana de
 *    48 h del pago / el plazo de confirmación), no la franja — superponerle
 *    `PASADA` por franja inventaría una transición que el negocio no tiene.
 *    Ver el barrido de lectores en SPEC-746 y la nota de acople con #715
 *    (`debeExponerContacto` en `./dto.ts`, futura clienta — no tocada aquí).
 *
 * Es imposible por TIPO que esta función devuelva `CONFIRMADA` crudo (el estado
 * que miente): la fase temporal lo reemplaza siempre, y ante entrada inválida
 * cae a `PASADA`. `Exclude<…, "CONFIRMADA">` hace estructural esa imposibilidad.
 */
import type { EstadoSolicitudCita } from "@prisma/client";

/** Fase temporal de una cita vigente (CONFIRMADA) respecto de su franja y `now`. */
export type FaseTemporalCita = "PROXIMA" | "EN_CURSO" | "PASADA";

/**
 * Estado EFECTIVO: la fase temporal (para una cita CONFIRMADA) o el estado de
 * negocio tal cual para el resto. Nunca `CONFIRMADA` crudo — esa es la mentira
 * que esta fuente elimina.
 */
export type EstadoEfectivoCita = FaseTemporalCita | Exclude<EstadoSolicitudCita, "CONFIRMADA">;

/** Entrada temporal tolerante: Date de Prisma, ISO string, epoch ms, o ausente. */
export type EntradaTiempo = Date | string | number | null | undefined;

/**
 * Normaliza una entrada temporal a epoch ms, o `null` si es ausente/basura.
 * `Date` inválida → NaN → null; string no parseable → NaN → null; number no
 * finito → null. Es la compuerta que garantiza el fallo conservador.
 */
function aEpochMs(v: EntradaTiempo): number | null {
    if (v === null || v === undefined) return null;
    const ms = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Date.parse(v);
    return Number.isFinite(ms) ? ms : null;
}

/**
 * SPEC-778 · ¿el reloj (`now`) es un instante UTILIZABLE? Reusa la MISMA normalización
 * que `estadoEfectivoDeCita`, para que la validez del tiempo sea UNA sola noción en el
 * producto (no una comprobación paralela). La usa `derivarEnlaceParaCita` para caer al
 * estado INDETERMINADO —sin afirmar que la hora pasó— cuando falta el reloj.
 */
export function relojUtilizable(v: EntradaTiempo): boolean {
    return aEpochMs(v) !== null;
}

/**
 * El estado EFECTIVO de una cita, contando el paso del tiempo.
 *
 * @param estadoPersistido  el `estado` guardado (EstadoSolicitudCita).
 * @param franjaInicio      inicio de la franja (Date/ISO/epoch ms).
 * @param franjaFin         fin de la franja (Date/ISO/epoch ms).
 * @param now               instante de referencia INYECTADO (Date/ISO/epoch ms).
 *                          No hay reloj de pared interno: ausente/basura → PASADA.
 */
export function estadoEfectivoDeCita(
    estadoPersistido: EstadoSolicitudCita,
    franjaInicio: EntradaTiempo,
    franjaFin: EntradaTiempo,
    now: EntradaTiempo,
): EstadoEfectivoCita {
    // Passthrough: todo estado que NO sea CONFIRMADA se devuelve tal cual. `now`
    // y la franja son irrelevantes acá — no inventamos fase para el negocio.
    if (estadoPersistido !== "CONFIRMADA") {
        return estadoPersistido;
    }

    // CONFIRMADA: el único estado donde el tiempo cambia la verdad. Se exige
    // franja y `now` válidos; cualquier hueco cae al lado conservador (PASADA).
    const inicio = aEpochMs(franjaInicio);
    const fin = aEpochMs(franjaFin);
    const ahora = aEpochMs(now);
    if (inicio === null || fin === null || ahora === null || inicio > fin) {
        return "PASADA";
    }

    if (ahora < inicio) return "PROXIMA";
    if (ahora < fin) return "EN_CURSO";
    return "PASADA";
}
