/**
 * SPEC-814 (T7 de 790) · La COLA de reubicación: qué citas CONFIRMADA quedaron SIN quién las
 * atienda. [NORMA] Res. 3100 art. 19 (continuidad) y art. 8.5 (una sesión confirmada no la atiende
 * un inactivo).
 *
 * TRIGGER (veredicto CEO · radicado SPEC-814) — por SIMETRÍA con el gate de la RESERVA:
 *
 *   huérfana(cita) ⟺  ¬habilitado(A)
 *                 OR  ¬esRepsElegibleParaModalidad(A, modalidadRepsRequerida(cita.franja.modalidad))
 *
 * El criterio que SACA una cita y el que ADMITE un destino son el MISMO gate → no hay hueco entre
 * ellos: nunca se propone un destino que la reserva rechaza, ni se mueve una cita que A sí podía
 * atender. Los dos términos son NECESARIOS y no redundantes: `esRepsElegibleParaModalidad` es solo
 * REPS; `habilitado` es ACTIVO ∧ verificación interna (SPEC-790 le quitó el REPS a `habilitado` a
 * propósito, para no encerrar al profesional fuera de su panel). Una cuenta inactiva con REPS
 * impecable NO la caza el chequeo de REPS — y al revés.
 *
 * Y el motivo se DISTINGUE, porque le cambia la acción al operador:
 *   · `PANEL_BLOQUEADO` (¬habilitado): el profesional NO puede actuar —no entra a su panel, no puede
 *     arreglar nada—. Reubicar es la ÚNICA salida.
 *   · `REGISTRO_NO_VIGENTE` (¬REPS para la modalidad): el profesional SÍ opera, ve su panel y PUEDE
 *     renovar su REPS (SPEC-813 ya le avisa). Reubicar de inmediato desperdiciaría ese aviso; el
 *     orden por urgencia (franja más próxima) decide si se espera o no.
 * Si ambos disparan, `PANEL_BLOQUEADO` manda (si no puede ni entrar, la renovación es irrelevante).
 *
 * El «a QUIÉN va» (candidatos §1-bis) vive en el matcher (SPEC-832, detrás de 825), no acá. Esta
 * cola es la cara PRINCIPAL de la pantalla (la mediana de candidatos medida en prod es 0).
 *
 * Minimización (FORMA §3): el DTO lleva SOLO lo necesario para emparejar —franja, modalidad, ciudad
 * (si presencial), nombre y especialidades de A (base del calce), y una referencia corta—; NUNCA el
 * relato ni la PII de la familia. La cita no guarda área ni edad (no se capturaron): no se exponen
 * porque no existen.
 */
import type { ModalidadCita } from "@prisma/client";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";
import { modalidadRepsRequerida } from "@/lib/profesional/reps/modalidad-cita-a-reps";

/**
 * Por qué la cita quedó huérfana — el dato que al operador le CAMBIA la acción (no es copy; es el
 * discriminador. La copy visible la resuelve la pantalla contra la forma de Diseño).
 */
export type MotivoReubicacion = "PANEL_BLOQUEADO" | "REGISTRO_NO_VIGENTE";

export interface CitaPorReubicar {
    /** Referencia corta (8 car.) — como el `citaRef` del operador. Nunca PII. */
    citaRef: string;
    deQuienSale: {
        nombre: string;
        /** Discriminador del motivo (ver [[MotivoReubicacion]]); la pantalla lo mapea a copy. */
        motivoCodigo: MotivoReubicacion;
        /** Especialidades de A — la BASE del calce (§1-bis), no un dato de la familia. */
        especialidades: string[];
    };
    cita: {
        inicio: Date;
        fin: Date;
        modalidad: ModalidadCita;
        /** Solo en PRESENCIAL (la ciudad del consultorio de A); `null` en virtual. */
        ciudad: string | null;
    };
}

/**
 * Citas CONFIRMADA de profesionales que ya no pueden atenderlas, listas para reubicar, ordenadas
 * por urgencia (la franja más próxima primero: una cita de mañana urge más que una de la otra
 * semana — el orden hace el trabajo de un umbral de tiempo, sin sus bordes). `ahora`/`repo`/
 * `perfilRepo` se inyectan para el candado.
 */
export async function citasPorReubicar(
    ahora: Date = new Date(),
    repo: SolicitudCitaRepository = new SolicitudCitaRepository(),
    perfilRepo: PerfilProfesionalRepository = new PerfilProfesionalRepository(),
): Promise<CitaPorReubicar[]> {
    const citas = await repo.listarConfirmadasParaReubicacion();

    // Una consulta por profesional DISTINTO (varias citas lo comparten); el REPS además por modalidad.
    const habilitadoPorUsuario = new Map<string, boolean>();
    const repsOkPorProModalidad = new Map<string, boolean>();
    const salida: CitaPorReubicar[] = [];

    for (const c of citas) {
        const usuarioId = c.profesional.usuarioId;
        const profesionalId = c.profesional.id;

        // Término 1 · habilitado (eje PANEL: ACTIVO ∧ verificación interna). Fuente única.
        let habilitado = habilitadoPorUsuario.get(usuarioId);
        if (habilitado === undefined) {
            habilitado = (await obtenerHabilitacionProfesional(usuarioId, ahora))?.habilitado ?? false;
            habilitadoPorUsuario.set(usuarioId, habilitado);
        }

        // Término 2 · REPS para la MODALIDAD CONCRETA de la cita (el gate de la reserva).
        const modalidadReps = modalidadRepsRequerida(c.franja.modalidad);
        let repsOk: boolean;
        if (modalidadReps === null) {
            repsOk = false; // modalidad sin mapeo → fail-closed, igual que la reserva.
        } else {
            const clave = `${profesionalId}:${modalidadReps}`;
            const cacheado = repsOkPorProModalidad.get(clave);
            if (cacheado === undefined) {
                repsOk = await perfilRepo.esRepsElegibleParaModalidad(profesionalId, modalidadReps, ahora);
                repsOkPorProModalidad.set(clave, repsOk);
            } else {
                repsOk = cacheado;
            }
        }

        // Ninguno de los dos disparó → A sigue pudiendo atenderla → NO es huérfana.
        if (habilitado && repsOk) continue;

        // `PANEL_BLOQUEADO` manda sobre `REGISTRO_NO_VIGENTE`: si A no puede ni entrar a su panel,
        // que su REPS esté o no vigente es irrelevante —no puede renovar nada—.
        const motivoCodigo: MotivoReubicacion = !habilitado ? "PANEL_BLOQUEADO" : "REGISTRO_NO_VIGENTE";

        salida.push({
            citaRef: c.id.slice(0, 8),
            deQuienSale: {
                nombre: c.profesional.nombreVisible,
                motivoCodigo,
                especialidades: c.profesional.especialidades,
            },
            cita: {
                inicio: c.franja.inicio,
                fin: c.franja.fin,
                modalidad: c.franja.modalidad,
                ciudad: c.franja.modalidad === "PRESENCIAL" ? (c.profesional.ciudad?.nombre ?? null) : null,
            },
        });
    }

    // Urgencia: la franja más próxima primero.
    salida.sort((a, b) => a.cita.inicio.getTime() - b.cita.inicio.getTime());
    return salida;
}
