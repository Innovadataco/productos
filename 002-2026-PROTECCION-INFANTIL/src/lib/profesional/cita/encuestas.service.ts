/**
 * SPEC-429 (A-75 · brief §9-bis · orden CEO 23:5x) · Servicio de encuestas
 * post-cita. Guarda la respuesta del lado que corresponde, cruza r1/r2 con
 * el otro lado si ya respondió, y baja `Usuario.encuestaPendiente` cuando
 * al usuario no le queda ninguna cita CUMPLIDA sin responder.
 *
 * Contrato con SPEC-427: la activación de la encuesta la dispara
 * `alCumplirCita(solicitudId)` (ver `al-cumplir.ts`) — este service no
 * conoce el momento del cierre, sólo persiste respuestas y cruza.
 *
 * Q-3: acceso a Prisma vive en `EncuestaCitaRepository` y en
 * `IncidenteContradiccionEncuestaRepository`; este service no importa
 * `@/lib/prisma`.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { logAudit } from "@/lib/audit";
import {
    EncuestaCitaRepository,
    IncidenteContradiccionEncuestaRepository,
} from "@/lib/dal/repositories/encuesta-cita";
import { PREGUNTAS_PADRE, PREGUNTAS_PROFESIONAL, opcionesValidas, type DefinicionPregunta } from "./encuestas-preguntas";
import type { OrigenEncuestaCita } from "@prisma/client";

export type RespuestasEncuesta = Record<DefinicionPregunta["id"], string>;

/**
 * Normaliza r1 (¿se dio la cita?) a un valor comparable entre padre y
 * profesional. Cualquier «SI» del lado propio ≡ SE_DIO; cualquier «NO_*» ≡ NO.
 */
function normalizarR1SeDio(valor: string): "SE_DIO" | "NO_SE_DIO" {
    if (valor === "SI") return "SE_DIO";
    return "NO_SE_DIO";
}

/**
 * Normaliza r2 (¿a tiempo?). Padre: SI/DEMORA/NO_SE_DIO. Prof: SI/DEMORA/NO_LLEGO.
 * SI → PUNTUAL · DEMORA → TARDE · el resto → NO. Comparación de igualdad estricta.
 */
function normalizarR2Puntual(valor: string): "PUNTUAL" | "TARDE" | "NO" {
    if (valor === "SI") return "PUNTUAL";
    if (valor === "DEMORA") return "TARDE";
    return "NO";
}

/**
 * Cruza r1/r2 del par (padre, profesional) y crea las filas de incidente
 * cuando el valor normalizado difiere. Idempotente sobre (solicitudId,
 * pregunta): la @@unique corta cualquier duplicado.
 */
export async function cruzarEncuestasSiCompletas(solicitudId: string): Promise<{ contradicciones: number }> {
    const encuestasRepo = new EncuestaCitaRepository();
    const incidentesRepo = new IncidenteContradiccionEncuestaRepository();
    const encuestas = await encuestasRepo.listarPorSolicitud(solicitudId);
    if (encuestas.length < 2) return { contradicciones: 0 };
    const padre = encuestas.find((e) => e.origen === "PADRE");
    const profesional = encuestas.find((e) => e.origen === "PROFESIONAL");
    if (!padre || !profesional) return { contradicciones: 0 };

    let contradicciones = 0;

    if (normalizarR1SeDio(padre.r1) !== normalizarR1SeDio(profesional.r1)) {
        try {
            await incidentesRepo.crear({
                solicitudId,
                pregunta: "P1",
                padreValor: padre.r1,
                profesionalValor: profesional.r1,
            });
            contradicciones += 1;
        } catch (err) {
            // Unique(solicitudId, pregunta): ya existe, tratamos como idempotente.
            logger.warn(`[ENCUESTAS] Incidente P1 ya existía para ${solicitudId}`, err);
        }
    }

    if (normalizarR2Puntual(padre.r2) !== normalizarR2Puntual(profesional.r2)) {
        try {
            await incidentesRepo.crear({
                solicitudId,
                pregunta: "P2",
                padreValor: padre.r2,
                profesionalValor: profesional.r2,
            });
            contradicciones += 1;
        } catch (err) {
            logger.warn(`[ENCUESTAS] Incidente P2 ya existía para ${solicitudId}`, err);
        }
    }

    if (contradicciones > 0) {
        // `usuarioId` en AuditLog es FK a Usuario — usamos el padre porque el
        // evento no lo dispara un actor sino el sistema al comparar. La historia
        // real (quién respondió qué) vive en `IncidenteContradiccionEncuesta`.
        const partes = await encuestasRepo.resolverPartes(solicitudId);
        if (partes) {
            await logAudit({
                accion: "ENCUESTA_CITA_CONTRADICCION",
                tipoRecurso: "SolicitudCita",
                recursoId: solicitudId,
                usuarioId: partes.padreUsuarioId,
                valorNuevo: JSON.stringify({ contradicciones }),
                ipAddress: "sistema",
                userAgent: "encuestas.service",
            });
        }
    }

    return { contradicciones };
}

function validarRespuestas(origen: OrigenEncuestaCita, respuestas: RespuestasEncuesta): void {
    const preguntas = origen === "PADRE" ? PREGUNTAS_PADRE : PREGUNTAS_PROFESIONAL;
    for (const pregunta of preguntas) {
        const valor = respuestas[pregunta.id];
        const validas = opcionesValidas(preguntas, pregunta.id);
        if (!valor || !validas.includes(valor)) {
            throw new AppError(
                `Respuesta inválida para ${pregunta.id} (${origen.toLowerCase()}): '${String(valor)}'. Debe ser una de ${validas.join(", ")}`,
                ERROR_CODES.VALIDATION_ERROR,
                400,
            );
        }
    }
}

/**
 * Registra la encuesta de un lado (padre o profesional) y cruza si el otro
 * ya había respondido. Baja `encuestaPendiente` del usuario si no le queda
 * ninguna otra cita CUMPLIDA sin responder.
 */
export async function registrarRespuestaEncuesta(input: {
    solicitudId: string;
    usuarioId: string;
    origen: OrigenEncuestaCita;
    respuestas: RespuestasEncuesta;
}): Promise<{ encuestaId: string; contradicciones: number }> {
    validarRespuestas(input.origen, input.respuestas);

    const repo = new EncuestaCitaRepository();
    const solicitud = await repo.resolverPartes(input.solicitudId);
    if (!solicitud) {
        throw new AppError("Cita no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (solicitud.estado !== "CUMPLIDA") {
        throw new AppError("La encuesta se responde después de que la cita se marque como cumplida", ERROR_CODES.VALIDATION_ERROR, 400);
    }
    const usuarioEsperado =
        input.origen === "PADRE" ? solicitud.padreUsuarioId : solicitud.profesional.usuarioId;
    if (usuarioEsperado !== input.usuarioId) {
        throw new AppError("No podés responder la encuesta del otro lado de esta cita", ERROR_CODES.FORBIDDEN, 403);
    }

    let encuestaId: string;
    try {
        const creada = await repo.crear({
            solicitudId: input.solicitudId,
            origen: input.origen,
            r1: input.respuestas.r1,
            r2: input.respuestas.r2,
            r3: input.respuestas.r3,
            r4: input.respuestas.r4,
            r5: input.respuestas.r5,
        });
        encuestaId = creada.id;
    } catch (err) {
        // Unique(solicitudId, origen): ya respondiste esta encuesta.
        logger.warn(`[ENCUESTAS] Intento de doble respuesta para ${input.solicitudId} (${input.origen})`, err);
        throw new AppError("Ya respondiste tu encuesta para esta cita", ERROR_CODES.CONFLICT, 409);
    }

    // Audit ANTES del cruce: cada lado deja su marca.
    await logAudit({
        accion: "ENCUESTA_CITA_RESPONDIDA",
        tipoRecurso: "SolicitudCita",
        recursoId: input.solicitudId,
        usuarioId: input.usuarioId,
        valorNuevo: JSON.stringify({ origen: input.origen, encuestaId }),
        ipAddress: "usuario",
        userAgent: "encuestas.service",
    });

    const cruce = await cruzarEncuestasSiCompletas(input.solicitudId);

    await recalcularEncuestaPendiente(input.usuarioId);

    return { encuestaId, contradicciones: cruce.contradicciones };
}

/**
 * Cuenta las citas CUMPLIDA del usuario en cualquier lado sin encuesta suya y
 * setea `Usuario.encuestaPendiente` en consecuencia. Se llama tras registrar
 * y también desde `alCumplirCita` (que solo sube a `true`).
 */
export async function recalcularEncuestaPendiente(usuarioId: string): Promise<boolean> {
    const repo = new EncuestaCitaRepository();
    const [pendientesPadre, pendientesProf] = await Promise.all([
        repo.contarPendientesPadre(usuarioId),
        repo.contarPendientesProfesional(usuarioId),
    ]);
    const pendiente = pendientesPadre + pendientesProf > 0;
    await repo.setEncuestaPendienteUsuario(usuarioId, pendiente);
    return pendiente;
}

/**
 * Devuelve la primera cita pendiente para el usuario (padre O profesional).
 * Ordenamos por más antigua primero: cerrás en el orden en que ocurrieron.
 */
export async function proximaEncuestaPendiente(usuarioId: string): Promise<{
    solicitudId: string;
    origen: OrigenEncuestaCita;
} | null> {
    const repo = new EncuestaCitaRepository();
    const [padre, prof] = await Promise.all([
        repo.proximaPendientePadre(usuarioId),
        repo.proximaPendienteProfesional(usuarioId),
    ]);
    if (!padre && !prof) return null;
    if (padre && (!prof || padre.actualizadoEn <= prof.actualizadoEn)) {
        return { solicitudId: padre.id, origen: "PADRE" };
    }
    return { solicitudId: prof!.id, origen: "PROFESIONAL" };
}
