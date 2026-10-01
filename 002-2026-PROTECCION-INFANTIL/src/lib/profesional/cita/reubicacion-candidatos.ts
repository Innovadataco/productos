/**
 * SPEC-814 (T7 de 790) · A QUIÉN se puede REUBICAR una cita CONFIRMADA cuyo profesional
 * quedó inhabilitado. [NORMA] Res. 3100 art. 19 (continuidad: el caso se REUBICA) y art. 8.5
 * (una sesión confirmada no la atiende un inactivo). La pregunta de la pantalla NO es
 * «¿cancelo?» (prohibido) sino «¿a qué profesional habilitado va esta cita?».
 *
 * El candidato de una cita = profesional **≠ el actual**, **habilitado por la FUENTE ÚNICA**
 * (misma que el directorio del padre), que **calza** (área + ciudad si es presencial) y tiene
 * una **franja PUBLICADA y LIBRE de la misma modalidad que SOLAPA** la hora de la cita.
 *
 * Tres decisiones del CEO sobre el calce (radicado SPEC-814, veredictos 01-10):
 *  · **Habilitado vía la fuente única, no enumerando condiciones.** `obtenerPublicoPorId`
 *    aplica el término `estaHabilitado` (estado ACTIVO ∧ verificación vigente) + exclusión de
 *    sembrados. Cuando #792 sume REPS al predicado, este matcher lo HEREDA sin tocarse. Un
 *    candado que hoy pasa porque el cutover es laxo (`exigirRepsVerificado=false`) no prueba
 *    el mañana: la afirmación es sobre la FUENTE, no sobre el resultado de hoy.
 *  · **El área se DERIVA del profesional que sale (A).** La cita nunca capturó el área que
 *    requería; no se puede saber retroactivamente por qué el padre eligió a A. «B comparte ≥1
 *    `especialidades` con A» es una heurística honesta y NO más débil que lo que la reserva
 *    garantizaba (la reserva tampoco exigió una especialidad concreta). `especialidades` es el
 *    campo VIVO del calce; `areasAtencion`/`rangoEtario` existen en schema pero nadie los usa.
 *    **Rango etario FUERA**: la reubicación calza con los MISMOS criterios que la reserva, y la
 *    reserva no chequeaba rango — exigirlo rechazaría candidatos que la reserva habría aceptado.
 *  · **El calce parcial se ACEPTA pero se MUESTRA.** Si A tiene {X,Y} y B {Y,Z}, B califica por
 *    Y y NO cubre X. No se esconde: cada candidato reporta qué comparte y qué deja sin cubrir,
 *    para que un humano decida. La alternativa a un B parcial no es un B perfecto —es NINGÚN
 *    servicio (65% de las citas no tienen candidato alguno), y el art. 19 pide continuidad, no
 *    perfección.
 *
 * Es SOLO LECTURA (deriva candidatos en vivo; así la cola «sin candidato hoy» re-calza sola
 * cuando mañana alguien publica un turno). El WRITE de la reubicación (fila nueva + origen →
 * REUBICADA) vive aparte y espera el enum de Datos.
 */
import type { ModalidadCita } from "@prisma/client";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { AppError, ERROR_CODES } from "@/lib/errors";

export interface CandidatoReubicacion {
    profesionalId: string;
    nombreVisible: string;
    /** Especialidades de B que TAMBIÉN tiene A — el porqué de que B califique. */
    especialidadesCompartidas: string[];
    /** Especialidades que A cubría y B NO — el calce parcial, a la vista (nunca escondido). */
    especialidadesNoCubiertas: string[];
}

export interface RequisitosReubicacion {
    inicio: Date;
    fin: Date;
    modalidad: ModalidadCita;
    /**
     * `especialidades` del profesional que SALE (A). El área del calce se deriva de A porque la
     * cita no guarda el área que requiere. Vacío = A sin especialidades → NO se exige área (no
     * se rechaza a nadie por un dato ausente de A); todos los demás filtros siguen aplicando.
     */
    areasDelProfesionalActual: string[];
    /** `ciudadId` de A — pesa SOLO en PRESENCIAL (misma ciudad del consultorio). */
    ciudadIdDelProfesionalActual: string;
    /** A — se excluye de sus propios candidatos (reubicar es a OTRO). */
    excluirProfesionalId: string;
}

interface MatcherDeps {
    franjaRepo: FranjaDisponibleRepository;
    perfilRepo: PerfilProfesionalRepository;
}

/**
 * Núcleo del matcher, con dependencias inyectables para el candado. Primero estrecha por el
 * CUELLO (franja libre que solapa — la mediana es 0), y SOLO sobre esos pocos pregunta a la
 * fuente única si están habilitados y calzan. El orden importa: evita cargar todo el directorio
 * para intersectarlo después.
 */
export async function candidatosDeReubicacion(
    req: RequisitosReubicacion,
    ahora: Date = new Date(),
    deps: MatcherDeps = {
        franjaRepo: new FranjaDisponibleRepository(),
        perfilRepo: new PerfilProfesionalRepository(),
    },
): Promise<CandidatoReubicacion[]> {
    const { franjaRepo, perfilRepo } = deps;

    // 1) EL CUELLO: profesionales ≠ A con una franja libre de la misma modalidad que solapa.
    const conFranja = await franjaRepo.profesionalesConFranjaLibreSolapando(
        req.inicio,
        req.fin,
        req.modalidad,
        req.excluirProfesionalId,
    );

    const candidatos: CandidatoReubicacion[] = [];
    for (const { profesionalId } of conFranja) {
        // 2) HABILITADO por la FUENTE ÚNICA (no enumero estado/vigencia/REPS acá). `viewer=null`
        //    ⇒ se excluyen los sembrados: no se reubica la cita de un menor a un profesional demo.
        //    Un inactivo / vencido / de verificación no vigente ⇒ `null` ⇒ fuera: el gate no
        //    falla abierto (criterio de auditoría (b)).
        const pub = await perfilRepo.obtenerPublicoPorId(profesionalId, null, ahora);
        if (!pub) continue;

        // 3) CALCE de ÁREA: B debe compartir ≥1 `especialidades` con A (si A tiene). Rango
        //    etario FUERA. El calce parcial se acepta — pero se calcula el hueco para mostrarlo.
        const compartidas = pub.especialidades.filter((e) => req.areasDelProfesionalActual.includes(e));
        if (req.areasDelProfesionalActual.length > 0 && compartidas.length === 0) continue;
        const noCubiertas = req.areasDelProfesionalActual.filter((e) => !pub.especialidades.includes(e));

        // 4) CALCE de CIUDAD: solo en PRESENCIAL (en virtual la ciudad no restringe).
        if (req.modalidad === "PRESENCIAL" && pub.ciudadId !== req.ciudadIdDelProfesionalActual) continue;

        candidatos.push({
            profesionalId: pub.id,
            nombreVisible: pub.nombreVisible,
            especialidadesCompartidas: compartidas,
            especialidadesNoCubiertas: noCubiertas,
        });
    }

    return candidatos;
}

/**
 * Carga una cita y deriva sus candidatos. La cola/pantalla decide QUÉ citas mostrar (las
 * CONFIRMADA de un profesional inhabilitado); este loader solo responde «¿quién puede tomar la
 * franja de ESTA cita?». No gatea por estado a propósito, para que sirva también a un re-calce.
 */
export async function candidatosParaCita(
    citaId: string,
    ahora: Date = new Date(),
): Promise<CandidatoReubicacion[]> {
    const cita = await new SolicitudCitaRepository().findParaReubicacion(citaId);
    if (!cita) throw new AppError("Cita no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (!cita.franja) throw new AppError("La cita no tiene franja asociada", ERROR_CODES.VALIDATION_ERROR, 400);
    return candidatosDeReubicacion(
        {
            inicio: cita.franja.inicio,
            fin: cita.franja.fin,
            modalidad: cita.franja.modalidad,
            areasDelProfesionalActual: cita.profesional.especialidades,
            ciudadIdDelProfesionalActual: cita.profesional.ciudadId,
            excluirProfesionalId: cita.profesionalId,
        },
        ahora,
    );
}
