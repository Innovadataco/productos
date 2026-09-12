/**
 * SPEC-676 · Plan PURO (sin BD) del poblador de la Red de Apoyo.
 *
 * Vive separado del script `poblar-red-apoyo.ts` (que toca Prisma) para que el
 * candado pruebe la LÓGICA sin base: la distribución de los 9 estados, la
 * visibilidad del profesional (SPEC-449) y el invariante franja↔estado — sin el
 * tax de BD ni el riesgo de correr un poblador de prod en un test.
 *
 * Volúmenes y reparto: definidos por DATOS (idc-29) para que la analítica de BI
 * signifique algo (ranking con forma, histograma con varianza, filtro por
 * modalidad con conjuntos distintos). Ver scratchpad SPEC-676.
 */
import type { EstadoSolicitudCita, ModalidadCita } from "@prisma/client";
import { calcularVenceEn } from "@/lib/profesionales/vigencia";
import {
    ESTADO_PERFIL_DEMO,
    RESULTADO_VERIFICACION_DEMO,
    REVISADO_HACE_DIAS,
    verificacionDemo,
} from "./profesional-demo";

export const CORRIDA_RED = "red-apoyo-676";
export const SCRIPT_RED = "poblar-red-apoyo";

// ── Profesionales ─────────────────────────────────────────────────────────
export const NUM_PROFESIONALES = 50;
/** Sesgo de actividad (suma 50): que el ranking tenga cabeza/medio/cola, no meseta. */
export const PROF_ALTA = 10;
export const PROF_MEDIA = 25;
export const PROF_BAJA = 15; // baja/nuevos; algunos ACTIVOS con SOLO franjas futuras y cero historia.

/** Reparto de modalidad (suma 50): el filtro del directorio devuelve conjuntos DISTINTOS. */
export const PROF_VIRTUAL_ONLY = 15;
export const PROF_PRESENCIAL_ONLY = 13;
export const PROF_AMBAS = 22;

/** Franjas libres futuras por profesional ACTIVO (agendables hoy). */
export const FRANJAS_LIBRES_MIN = 6;
export const FRANJAS_LIBRES_MAX = 12;

/** Ventana histórica de citas (meses). Parametrizable; Datos recomienda 24. */
export const VENTANA_MESES = 24;

// ── Distribución de los 9 estados (Datos) ───────────────────────────────────
// Record sobre EstadoSolicitudCita → TS obliga a listar los 9 (candado #2 los recorre).
export const OBJETIVO_ESTADOS: Record<EstadoSolicitudCita, number> = {
    CUMPLIDA: 600,
    CONFIRMADA: 130, // futuras (pipeline «agendar»)
    PAGADA_PENDIENTE: 65,
    SIN_CONFIRMAR: 35,
    NO_ASISTIO_PADRE: 55, // CERO reembolso
    VENCIDA_SIN_RESPUESTA: 55, // silencio del profesional → ejercita el barrido SPEC-657
    NO_ASISTIO_PROFESIONAL: 22,
    REEMBOLSADA: 30, // SOLO de la población silencio-del-profesional, nunca del padre (D-137)
    REPROGRAMADA: 80, // cada una es una CADENA largo-1: original REPROGRAMADA → hija CUMPLIDA
};

/**
 * Estados que LIBERAN la franja (tomada=false) pero conservan su `franjaId`:
 * son los únicos que llaman `liberar()` en el producto — reprogramación
 * (cita.service.ts) y vencimiento 48h (worker.ts + rechazarPorProfesional).
 * Todos los demás estados OCUPAN la franja (tomada=true, tomada al crear).
 */
export const ESTADOS_FRANJA_LIBERADA: readonly EstadoSolicitudCita[] = ["REPROGRAMADA", "VENCIDA_SIN_RESPUESTA"];

export function esEstadoLiberado(estado: EstadoSolicitudCita): boolean {
    return ESTADOS_FRANJA_LIBERADA.includes(estado);
}

/** Invariante franja↔estado: la franja está tomada salvo en los estados que la liberan. */
export function franjaTomadaPara(estado: EstadoSolicitudCita): boolean {
    return !esEstadoLiberado(estado);
}

/**
 * Estados NO terminales: la cita sigue VIVA (reloj corriendo). Se siembran con
 * `creadoEn` RECIENTE y cita a FUTURO para caer FUERA de la ventana de los
 * barridos de `worker.ts`: el de vencimiento recoge PAGADA_PENDIENTE con el pago
 * > 48 h; el del plazo recoge SIN_CONFIRMAR con `venceEn` pasado. Sembrarlas con
 * fechas históricas las haría vencer solas en la próxima corrida del worker
 * (cada 15 min): ~100 filas volcadas a VENCIDA, distribución destruida y
 * profesionales suspendidos (3+ consecutivas) saliendo del directorio — el
 * candado de visibilidad roto en runtime, no en CI. Candado #4 lo cierra.
 */
export const ESTADOS_VIVOS: readonly EstadoSolicitudCita[] = ["CONFIRMADA", "PAGADA_PENDIENTE", "SIN_CONFIRMAR"];

export function esEstadoVivo(estado: EstadoSolicitudCita): boolean {
    return ESTADOS_VIVOS.includes(estado);
}

/**
 * Reloj de una cita viva sembrada. `HORAS_CITA_VIVA_MAX + HORAS_PAGO_APROBADO`
 * debe quedar por DEBAJO de las 48 h del barrido de vencimiento (con holgura), y
 * `HORAS_PLAZO_PADRE - HORAS_CITA_VIVA_MAX` positivo para que SIN_CONFIRMAR
 * conserve `venceEn` futuro. Candado #4 verifica ambos.
 */
export const HORAS_CITA_VIVA_MIN = 2;
export const HORAS_CITA_VIVA_MAX = 30;
export const HORAS_PAGO_APROBADO = 6; // pagoAprobadoEn = creadoEn + 6 h (pagoAprobadoPara)
export const HORAS_PLAZO_PADRE = 72; // venceEn = creadoEn + 72 h

/**
 * Población de la que sale REEMBOLSADA: el silencio del profesional
 * (NO_ASISTIO_PROFESIONAL + VENCIDA_SIN_RESPUESTA), NUNCA el no-asistió del padre
 * (D-137). El poblador crea las filas REEMBOLSADA directo; esto documenta y
 * candadea el origen conceptual + la asimetría.
 */
export const POBLACION_REEMBOLSO: readonly EstadoSolicitudCita[] = ["NO_ASISTIO_PROFESIONAL", "VENCIDA_SIN_RESPUESTA"];

// ── Encuesta de primera cita (satisfacción · Kimi) ──────────────────────────
/** Puntaje repartido: ~60% 4-5, ~30% 3, ~10% 1-2 (que el tablero no salga plano). */
export const ENCUESTA_PUNTAJES: readonly { puntaje: number; peso: number }[] = [
    { puntaje: 5, peso: 0.35 },
    { puntaje: 4, peso: 0.25 },
    { puntaje: 3, peso: 0.30 },
    { puntaje: 2, peso: 0.06 },
    { puntaje: 1, peso: 0.04 },
];

// ── Helpers puros de plan ───────────────────────────────────────────────────

/** Modalidades de un profesional por índice, respetando el reparto (I-398: ≥1). */
export function modalidadesDeProfesional(idx: number): ModalidadCita[] {
    if (idx < PROF_VIRTUAL_ONLY) return ["VIRTUAL"];
    if (idx < PROF_VIRTUAL_ONLY + PROF_PRESENCIAL_ONLY) return ["PRESENCIAL"];
    return ["VIRTUAL", "PRESENCIAL"];
}

/** Bucket de actividad por índice: 'alta' | 'media' | 'baja'. */
export function bucketActividad(idx: number): "alta" | "media" | "baja" {
    if (idx < PROF_ALTA) return "alta";
    if (idx < PROF_ALTA + PROF_MEDIA) return "media";
    return "baja";
}

/**
 * Lista determinista de estados (uno por cita DIRECTA, sin contar las hijas de
 * reprogramación) que respeta EXACTAMENTE los objetivos. Garantiza que los 9
 * estados estén representados (candado #2). El REPROGRAMADA cuenta la cadena
 * (la fila original); su hija CUMPLIDA la agrega el seeder aparte.
 */
export function construirPlanEstados(): EstadoSolicitudCita[] {
    const plan: EstadoSolicitudCita[] = [];
    for (const estado of Object.keys(OBJETIVO_ESTADOS) as EstadoSolicitudCita[]) {
        for (let i = 0; i < OBJETIVO_ESTADOS[estado]; i++) plan.push(estado);
    }
    return plan;
}

/** La forma del perfil/verificación que hace VISIBLE a un profesional (SPEC-449). */
export function perfilVisibleDemo(revisadoEn: Date) {
    return {
        estado: ESTADO_PERFIL_DEMO, // ACTIVO
        verificacion: verificacionDemo(revisadoEn), // APROBADO + venceEn = revisadoEn+4meses (vigente)
    };
}

export { ESTADO_PERFIL_DEMO, RESULTADO_VERIFICACION_DEMO, REVISADO_HACE_DIAS, calcularVenceEn };
