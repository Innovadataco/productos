/**
 * SPEC-832 (pieza 2) · El READ MODEL de la pantalla de reubicación: la COLA (citasPorReubicar) + por cada
 * cita, los CANDIDATOS (el matcher) y, por candidato, sus TURNOS concretos que solapan (para el segundo
 * paso del picker). Es el punto que CABLEA el matcher a producción — por eso sale de la allowlist de
 * huérfanos (salida autoexigida).
 *
 * La mayoría de las citas NO tiene candidatos (la mediana medida en prod es 0): para esas, `candidatos`
 * viene vacío y la pantalla muestra el estado «sin candidato» (§2) con su salida —seguir en la cola, que
 * re-calza sola— nunca un vacío mudo. Minimización intacta: el matcher ya no trae relato ni PII.
 */
import { citasPorReubicar, type CitaPorReubicar } from "./reubicacion-cola";
import { candidatosParaCita } from "./reubicacion-candidatos";
import { FranjaDisponibleRepository } from "@/lib/dal/repositories/franja-disponible";

export interface TurnoCandidato {
    id: string;
    inicio: Date;
    fin: Date;
}

export interface CandidatoConTurnos {
    profesionalId: string;
    nombreVisible: string;
    /** §1-bis: lo que B comparte con A — por qué califica. */
    especialidadesCompartidas: string[];
    /** §1-bis: lo que A atendía y B NO cubre — el calce parcial, a la vista. */
    especialidadesNoCubiertas: string[];
    /** Los turnos de B que solapan la cita (el admin elige uno). */
    turnos: TurnoCandidato[];
}

export interface CitaConCandidatos extends CitaPorReubicar {
    candidatos: CandidatoConTurnos[];
}

/**
 * Arma los datos de la pantalla. N+1 a propósito y acotado: la cola ya es chica (citas de profesionales
 * inhabilitados) y la mediana de candidatos es 0 — superficie de admin, bajo volumen. `ahora`/`franjaRepo`
 * inyectables para el candado.
 */
export async function datosPantallaReubicacion(
    ahora: Date = new Date(),
    franjaRepo: FranjaDisponibleRepository = new FranjaDisponibleRepository(),
): Promise<CitaConCandidatos[]> {
    const cola = await citasPorReubicar(ahora);
    return Promise.all(
        cola.map(async (fila) => {
            const candidatos = await candidatosParaCita(fila.citaId, ahora);
            const candidatosConTurnos = await Promise.all(
                candidatos.map(async (cand) => ({
                    profesionalId: cand.profesionalId,
                    nombreVisible: cand.nombreVisible,
                    especialidadesCompartidas: cand.especialidadesCompartidas,
                    especialidadesNoCubiertas: cand.especialidadesNoCubiertas,
                    turnos: await franjaRepo.franjasOfreciblesSolapando(
                        cand.profesionalId,
                        fila.cita.inicio,
                        fila.cita.fin,
                        fila.cita.modalidad,
                        ahora,
                    ),
                })),
            );
            return { ...fila, candidatos: candidatosConTurnos };
        }),
    );
}
