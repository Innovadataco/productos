/**
 * SPEC-790 · El MOTOR de la verificación REPS — la decisión PURA de elegibilidad.
 *
 * El falso amigo original: el producto llamaba «habilitado» al estado INTERNO de onboarding
 * (`PerfilProfesional.estado` + `VerificacionProfesional`) y NUNCA comprobaba la inscripción ante el
 * Estado (REPS). Si el prestador es el profesional (Opción A), esa comprobación ES el control. Y CADUCA.
 *
 * Esta pieza NO toca Prisma: trabaja contra el CONTRATO del HECHO (que implementa Datos, append-only) y
 * se prueba como unit. El estado actual se DERIVA de la última fila — nunca de una columna cacheada.
 *
 * `EstadoReps` tiene CUATRO valores y el motor los trata DISTINTO (D-7, cutover):
 *  · `VENCIDA` / `NO_ENCONTRADA` → cierran SIEMPRE (sabemos que está mal).
 *  · `SIN_VERIFICAR` → lo rige `exigirRepsVerificado` (hoy hay CERO verificados; una compuerta que nadie
 *    puede liberar es peor que ninguna). NUNCA se trata igual que `VIGENTE` en silencio.
 *  · `VIGENTE` → elegible sii pasa los DOS RELOJES (D-4) y cubre la modalidad del servicio (D-5).
 */

/**
 * Los cuatro resultados del REPS. Espejo del enum que implementa Datos; SEPARADO de
 * `EstadoPerfilProfesional` (el candado C-1 exige que los conjuntos sean DISJUNTOS para que el
 * «habilitado» interno y el REPS no se confundan). Runtime-enumerable a propósito: así el candado
 * caza un valor nuevo que colisione, en vez de confiar en una lista escrita a mano.
 */
export const ESTADOS_REPS = ["VIGENTE", "VENCIDA", "NO_ENCONTRADA", "SIN_VERIFICAR"] as const;
export type EstadoReps = (typeof ESTADOS_REPS)[number];

/**
 * Modalidad que HABILITA el REPS — categoría de la AUTORIDAD, no el formato de la cita (espejo del enum
 * PROPIO `ModalidadReps` del schema de Datos; NO es `ModalidadCita`). TELEMEDICINA corresponde al VIRTUAL
 * de la cita; el motor evalúa «¿`modalidadRequerida` está en lo que el REPS habilita?». El mapeo
 * cita→REPS (VIRTUAL→TELEMEDICINA, PRESENCIAL→PRESENCIAL) vive en el gate (T4), no aquí.
 */
export const MODALIDADES_REPS = ["PRESENCIAL", "TELEMEDICINA"] as const;
export type ModalidadReps = (typeof MODALIDADES_REPS)[number];

/** El HECHO de la última verificación REPS (shape del contrato de Datos; sin Prisma, para el candado). */
export interface HechoReps {
    readonly resultado: EstadoReps;
    /** Cuándo verificamos NOSOTROS (nuestro reloj). */
    readonly verificadoEn: Date;
    /** Fecha de la AUTORIDAD (Res. 3100 art. 10). `null` = el REPS no dio vigencia (p. ej. no encontrado). */
    readonly vigenteHasta: Date | null;
    /** Las modalidades que el REPS reconoce para el servicio. Lista: la pregunta es si INCLUYE la requerida. */
    readonly modalidades: readonly ModalidadReps[];
}

export interface ConfigReps {
    /** NUESTRO reloj: cuánto confiamos en el último chequeo (default 365, parametrizable). */
    readonly ventanaVerificacionDias: number;
    /** Cutover (D-7): si `false`, `SIN_VERIFICAR` abre (con alarma en admin); si `true`, cierra. */
    readonly exigirRepsVerificado: boolean;
}

export interface Elegibilidad {
    readonly elegible: boolean;
    /** Motivo legible — para el operador/admin y para distinguir SIN_VERIFICAR de VIGENTE (nunca en silencio). */
    readonly motivo: string;
    /** El estado REPS que gobernó la decisión (para pintar la alarma del cutover sin re-derivar). */
    readonly estado: EstadoReps;
}

const DIA_MS = 24 * 60 * 60 * 1000;

const esFecha = (d: Date | null | undefined): d is Date => d instanceof Date && Number.isFinite(d.getTime());

/** Cutover de `SIN_VERIFICAR`: abre sii NO se exige el REPS verificado. Nunca igual a VIGENTE: lleva su motivo. */
function decidirSinVerificar(config: ConfigReps): Elegibilidad {
    return config.exigirRepsVerificado
        ? { elegible: false, motivo: "Falta verificar la inscripción en el REPS", estado: "SIN_VERIFICAR" }
        : { elegible: true, motivo: "REPS sin verificar — cutover abierto (alarma en admin)", estado: "SIN_VERIFICAR" };
}

/**
 * ¿Este profesional es REPS-elegible? PURA, fail-closed. `now` inyectado (sin reloj de pared); `now`
 * inválido → NO elegible (conservador). `modalidadRequerida`: una modalidad concreta (al RESERVAR) debe
 * estar cubierta por el REPS (D-5); `null` (lectura del DIRECTORIO, sin modalidad única) salta ese reloj
 * — la vigencia es la compuerta y la modalidad se exige en el punto de reserva, donde se conoce.
 */
export function repsElegible(
    hecho: HechoReps | null,
    modalidadRequerida: ModalidadReps | null,
    config: ConfigReps,
    now: Date,
): Elegibilidad {
    if (!esFecha(now)) return { elegible: false, motivo: "No se pudo evaluar el REPS (reloj inválido)", estado: "SIN_VERIFICAR" };
    if (!hecho) return decidirSinVerificar(config);

    switch (hecho.resultado) {
        case "SIN_VERIFICAR":
            return decidirSinVerificar(config);
        case "VENCIDA":
            return { elegible: false, motivo: "La inscripción en el REPS está vencida", estado: "VENCIDA" };
        case "NO_ENCONTRADA":
            return { elegible: false, motivo: "No se encontró al profesional en el REPS", estado: "NO_ENCONTRADA" };
        case "VIGENTE": {
            // Reloj (a) de la AUTORIDAD: sin fecha de vigencia NO es «vigente para siempre» — cierra.
            if (!esFecha(hecho.vigenteHasta)) {
                return { elegible: false, motivo: "El REPS no entregó fecha de vigencia", estado: "VIGENTE" };
            }
            if (hecho.vigenteHasta.getTime() <= now.getTime()) {
                return { elegible: false, motivo: "La vigencia del REPS ya pasó", estado: "VIGENTE" };
            }
            // Reloj (b) NUESTRO: la verificación no puede haber envejecido más allá de la ventana.
            const limiteNuestro = (esFecha(hecho.verificadoEn) ? hecho.verificadoEn.getTime() : -Infinity) + config.ventanaVerificacionDias * DIA_MS;
            if (limiteNuestro <= now.getTime()) {
                return { elegible: false, motivo: "Nuestra verificación del REPS envejeció — toca re-verificar", estado: "VIGENTE" };
            }
            // Modalidad (D-5): con una modalidad pedida, el REPS debe INCLUIRLA; `null` la salta (directorio).
            if (modalidadRequerida !== null && !hecho.modalidades.includes(modalidadRequerida)) {
                return { elegible: false, motivo: `El REPS no cubre la modalidad ${modalidadRequerida.toLowerCase()}`, estado: "VIGENTE" };
            }
            return { elegible: true, motivo: "REPS al día", estado: "VIGENTE" };
        }
    }
}
