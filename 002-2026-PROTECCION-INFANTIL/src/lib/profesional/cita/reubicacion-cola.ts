/**
 * SPEC-814 (T7 de 790) · La COLA de reubicación: qué citas CONFIRMADA quedaron SIN quién las
 * atienda. [NORMA] Res. 3100 art. 19 (continuidad) y art. 8.5 (una sesión confirmada no la atiende
 * un inactivo).
 *
 * TRIGGER (veredicto CEO · radicado SPEC-814; SPEC-852 lo colapsó) — por SIMETRÍA con el gate de la
 * RESERVA:
 *
 *   huérfana(cita) ⟺  ¬habilitado(A)
 *
 * El criterio que SACA una cita y el que ADMITE un destino son el MISMO gate → no hay hueco entre
 * ellos: nunca se propone un destino que la reserva rechaza, ni se mueve una cita que A sí podía
 * atender. `habilitado` es ACTIVO ∧ verificación INTERNA vigente (Ley 2375, documentos). Hasta
 * SPEC-852 había un segundo término (`esRepsElegibleParaModalidad`, solo REPS); al eliminarse REPS
 * por completo la cola queda con este único término.
 *
 * Por eso hay UN solo motivo, `PANEL_BLOQUEADO` (¬habilitado): el profesional NO puede actuar —no
 * entra a su panel, no puede arreglar nada—. Reubicar es la ÚNICA salida.
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
import { obtenerHabilitacionProfesional } from "@/lib/profesionales/habilitacion";

/**
 * Por qué la cita quedó huérfana — el dato que al operador le CAMBIA la acción (no es copy; es el
 * discriminador. La copy visible la resuelve la pantalla contra la forma de Diseño).
 *
 * SPEC-852 · UN solo motivo tras eliminar REPS:
 *  · `PANEL_BLOQUEADO` — el profesional NO puede entrar a su panel (¬habilitado = ¬(ACTIVO ∧ verificación
 *    INTERNA de documentos)). Reubicar es la única salida: no puede resolver nada por su cuenta. Antes había
 *    además motivos REPS (REGISTRO_NO_VIGENTE / REVISION_INTERNA, derivados de `clasificarReps`); al eliminarse
 *    REPS la cola queda con UN solo término (la verificación interna) y, por tanto, este único motivo.
 */
export type MotivoReubicacion = "PANEL_BLOQUEADO";

export interface CitaPorReubicar {
    /** id completo de la cita — para las ACCIONES del admin (reubicar). No es PII. */
    citaId: string;
    /** Referencia corta (8 car.) — como el `citaRef` del operador, para MOSTRAR. Nunca PII. */
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
): Promise<CitaPorReubicar[]> {
    const citas = await repo.listarConfirmadasParaReubicacion();

    // Una consulta por profesional DISTINTO (varias citas lo comparten).
    const habilitadoPorUsuario = new Map<string, boolean>();
    const salida: CitaPorReubicar[] = [];

    for (const c of citas) {
        const usuarioId = c.profesional.usuarioId;

        // SPEC-852 · tras eliminar REPS la cola tiene UN solo término: la verificación INTERNA de documentos.
        // Huérfana ⟺ ¬habilitado (= ¬(ACTIVO ∧ verificación interna)). Un profesional habilitado SIGUE pudiendo
        // atender → NO es huérfana. El único motivo es PANEL_BLOQUEADO.
        let habilitado = habilitadoPorUsuario.get(usuarioId);
        if (habilitado === undefined) {
            habilitado = (await obtenerHabilitacionProfesional(usuarioId, ahora))?.habilitado ?? false;
            habilitadoPorUsuario.set(usuarioId, habilitado);
        }
        if (habilitado) continue;

        const motivoCodigo: MotivoReubicacion = "PANEL_BLOQUEADO";

        salida.push({
            citaId: c.id,
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
