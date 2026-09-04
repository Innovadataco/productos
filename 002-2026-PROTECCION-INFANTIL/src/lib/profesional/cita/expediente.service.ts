/**
 * SPEC-427b (A-75 · L6 · brief §9 momento 6) · el código de EXPEDIENTE, de
 * punta a punta.
 *
 * Es la otra mitad del momento 6 que 427 dejó afuera por estar a medias. El
 * brief lo describe así: además del código de cita, si el padre eligió compartir
 * su expediente, le llega un SEGUNDO código. Se lo dicta al profesional en la
 * sesión; el profesional lo digita y con eso —y solo con eso— puede abrir el
 * expediente **en solo lectura**.
 *
 * Con las palabras del brief: la autorización a leer el expediente no es una
 * casilla marcada días antes, es un acto del padre en el momento. Si se
 * arrepiente, no entrega el código y no hay nada que revocar.
 *
 * Reserva legal H-2 (Ley 1918/2018 · 2375/2024): CADA lectura del expediente
 * por el profesional se audita. No alcanza con auditar que digitó el código:
 * hay que dejar rastro de cada vez que efectivamente lo abrió.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { CodigoCitaRepository } from "@/lib/dal/repositories/codigo-cita";
import { programar, despacharEnvios } from "@/lib/notificaciones/motor";
import { lecturaDelExpedientePorId } from "@/lib/dal/services/expediente-vivo";
import {
    emitirCodigo,
    validarCodigo,
    ANTICIPACION_RECORDATORIO_MS,
    VIGENCIA_CODIGO_MS,
    type MotivoRechazo,
} from "./codigos";

export const EVENTO_RECORDATORIO_EXPEDIENTE = "cita.codigo_expediente.recordatorio";

/** El mismo criterio de mensajes del cierre, para el código de expediente. */
const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
    sin_codigo: "Todavía no hay un código de expediente para esta cita. El padre puede pedirlo desde su cuenta.",
    expirado: "Ese código venció. Pedile al padre que solicite otro: llega al instante.",
    max_intentos: "Se agotaron los intentos con ese código. Pedile al padre que solicite otro.",
    incorrecto: "El código no coincide. Revisá los seis dígitos con el padre.",
    ya_usado: "Ese código ya se usó.",
};

function rechazo(motivo: MotivoRechazo): AppError {
    return new AppError(MENSAJE_RECHAZO[motivo], ERROR_CODES.CONFLICT, 409);
}

/** El perfil del profesional dueño de la solicitud, o 403. */
async function exigirDueno(solicitudId: string, profesionalUsuarioId: string) {
    const solicitud = await new SolicitudCitaRepository().findById(solicitudId);
    if (!solicitud) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(profesionalUsuarioId);
    if (!perfil || perfil.id !== solicitud.profesionalId) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return solicitud;
}

/**
 * ¿Este profesional ya digitó el código de expediente de esta cita?
 * El permiso vive en la fila usada del código: hay acceso si existe un código
 * de EXPEDIENTE usado. No se agrega una segunda verdad (un booleano aparte
 * podría contradecir la traza que el brief exige ver).
 */
export async function tieneAccesoAlExpediente(solicitudId: string): Promise<boolean> {
    const codigos = await new CodigoCitaRepository().listarPorSolicitud(solicitudId);
    return codigos.some((c) => c.tipo === "EXPEDIENTE" && c.usadoEn !== null);
}

/**
 * El profesional digita el código de expediente → queda habilitado a abrirlo.
 *
 * Consumir el código y dejar el rastro van en la MISMA transacción (lección
 * fix a de 427): si el audit fallara después de consumir, el código quedaría
 * quemado sin constancia de quién lo usó.
 */
export async function abrirExpedienteConCodigo(
    solicitudId: string,
    profesionalUsuarioId: string,
    codigo: string,
    ahora = new Date()
) {
    const solicitud = await exigirDueno(solicitudId, profesionalUsuarioId);
    if (!solicitud.expedienteCompartidoId) {
        throw new AppError(
            "El padre no compartió el expediente para esta cita.",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const v = await validarCodigo(solicitudId, "EXPEDIENTE", codigo, ahora);
    if (!v.ok) {
        await logAudit({
            accion: "CITA_PROFESIONAL_CODIGO_FALLIDO",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitudId,
            usuarioId: profesionalUsuarioId,
            metadatos: { tipo: "EXPEDIENTE", motivo: v.motivo },
            ipAddress: "profesional",
            userAgent: "cita/abrir-expediente",
        });
        throw rechazo(v.motivo);
    }

    await withUnitOfWork(async (tx) => {
        const consumido = await new CodigoCitaRepository(tx).marcarUsadoSiLibre(v.codigoId, ahora);
        if (!consumido) throw rechazo("ya_usado");
        await logAudit({
            accion: "CITA_PROFESIONAL_CODIGO_DIGITADO",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitudId,
            usuarioId: profesionalUsuarioId,
            metadatos: { tipo: "EXPEDIENTE", codigoId: v.codigoId, expedienteId: solicitud.expedienteCompartidoId },
            ipAddress: "profesional",
            userAgent: "cita/abrir-expediente",
            tx,
        });
    });

    return { expedienteId: solicitud.expedienteCompartidoId };
}

/**
 * La lectura del expediente para el profesional habilitado — SOLO LECTURA.
 *
 * Devuelve exactamente las mismas cifras de capa 1 que ve el padre (SPEC-340):
 * no hay una segunda vista ni un camino de escritura. Se calcula sobre el PADRE
 * dueño del expediente, no sobre el profesional.
 *
 * H-2: cada lectura deja su fila de auditoría. Enterarse de quién leyó el
 * expediente de un menor, y cuándo, es reserva legal — no un lujo.
 */
export async function lecturaExpedienteParaProfesional(
    solicitudId: string,
    profesionalUsuarioId: string
) {
    const solicitud = await exigirDueno(solicitudId, profesionalUsuarioId);
    if (!solicitud.expedienteCompartidoId) {
        throw new AppError("El padre no compartió el expediente para esta cita.", ERROR_CODES.CONFLICT, 409);
    }
    if (!(await tieneAccesoAlExpediente(solicitudId))) {
        throw new AppError(
            "Digitá el código de expediente que te dio el padre para abrirlo.",
            ERROR_CODES.FORBIDDEN,
            403
        );
    }

    const expedienteId = solicitud.expedienteCompartidoId;

    // H-2 · una fila por cada lectura, antes de devolver el contenido.
    await logAudit({
        accion: "CITA_PROFESIONAL_EXPEDIENTE_ABIERTO",
        tipoRecurso: "Expediente",
        recursoId: expedienteId,
        usuarioId: profesionalUsuarioId,
        metadatos: { solicitudId },
        ipAddress: "profesional",
        userAgent: "cita/leer-expediente",
    });

    // El DAL calcula la lectura sobre el PADRE dueño; el profesional ve lo mismo
    // que el padre, ni más ni menos. Prisma no sale del DAL (Q-3).
    return lecturaDelExpedientePorId(expedienteId);
}

interface CitaConExpediente {
    id: string;
    padreUsuario: { id: string; email: string; nombre: string | null };
    profesional: { nombreVisible: string };
    franja: { inicio: Date };
}

/** Formato humano de la hora de la cita, para el correo. */
function horaLegible(d: Date): string {
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Bogota",
    }).format(d);
}

/**
 * Emite el código de EXPEDIENTE de una cita y programa el correo al padre.
 *
 * Gemelo del recordatorio de la cita: código y aviso nacen en la misma
 * transacción (I-295), 10 minutos antes, con vigencia de 30. La diferencia es
 * que este segundo código solo existe si el padre compartió el expediente.
 */
async function emitirYProgramarExpediente(c: CitaConExpediente, ahora: Date) {
    const enviarEn = new Date(c.franja.inicio.getTime() - ANTICIPACION_RECORDATORIO_MS);
    const cuando = enviarEn > ahora ? enviarEn : ahora;

    const { aviso } = await withUnitOfWork(async (tx) => {
        const emitido = await emitirCodigo({
            solicitudId: c.id,
            tipo: "EXPEDIENTE",
            vigenteDesde: cuando,
            tx,
        });
        const aviso = await programar(
            {
                evento: EVENTO_RECORDATORIO_EXPEDIENTE,
                sujetoTipo: "SolicitudCita",
                sujetoId: c.id,
                enviarEn: cuando,
                destinatarios: [
                    {
                        usuarioId: c.padreUsuario.id,
                        email: c.padreUsuario.email,
                        rol: "PARENT",
                        variables: {
                            nombrePadre: c.padreUsuario.nombre ?? "",
                            nombreProfesional: c.profesional.nombreVisible,
                            horaCita: horaLegible(c.franja.inicio),
                            codigo: emitido.codigo,
                            minutosVigencia: VIGENCIA_CODIGO_MS / 60000,
                        },
                    },
                ],
            },
            { tx }
        );
        if (aviso.programadas === 0) {
            throw new AppError(
                "No se pudo encolar el código de expediente: falta la regla activa del motor. El código no se emitió.",
                ERROR_CODES.INTERNAL_ERROR,
                500
            );
        }
        const notificacionId = aviso.envios?.[0]?.notificacionId;
        if (notificacionId) {
            await new CodigoCitaRepository(tx).anotarNotificacion(emitido.codigoId, notificacionId);
        }
        return { emitido, aviso };
    });

    await logAudit({
        accion: "CITA_PROFESIONAL_CODIGO_EMITIDO",
        tipoRecurso: "SolicitudCita",
        recursoId: c.id,
        usuarioId: c.padreUsuario.id,
        metadatos: { tipo: "EXPEDIENTE", programadas: aviso.programadas },
        ipAddress: "worker",
        userAgent: "cita/codigo-expediente",
    });

    return { aviso };
}

/**
 * Barredor · el recordatorio con el código de EXPEDIENTE, 10 minutos antes.
 *
 * Idempotente por consulta (`codigos: { none: { tipo: "EXPEDIENTE" } }`): dos
 * corridas no emiten dos veces. `try/catch` por cita: una rota no frena a las
 * demás (lección fix e de 427).
 */
export async function barrerRecordatoriosDeExpediente(ahora = new Date()) {
    const desde = new Date(ahora.getTime() - 60 * 60 * 1000);
    const hasta = new Date(ahora.getTime() + ANTICIPACION_RECORDATORIO_MS);
    const citas = await new SolicitudCitaRepository().listarConfirmadasConExpedientePorArrancar(desde, hasta);

    let emitidos = 0;
    let errores = 0;
    for (const c of citas) {
        try {
            const { aviso } = await emitirYProgramarExpediente(c, ahora);
            emitidos += 1;
            await despacharEnvios(aviso.envios ?? []);
        } catch (e) {
            errores += 1;
            logger.error("[SPEC-427b] No se pudo emitir el código de expediente de una cita", {
                solicitudId: c.id,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    return { emitidos, errores };
}
