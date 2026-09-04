/**
 * SPEC-427 (A-75 · L6 · brief §9 momentos 6) · el cierre de la cita.
 *
 * Acá vive todo lo que pasa DESPUÉS de que la cita quedó confirmada: el envío
 * del código al padre, el momento en que el profesional lo digita, la apertura
 * del expediente, y el autocierre a los 5 días cuando nadie cerró nada.
 *
 * Separado de `cita.service.ts` a propósito: ese módulo es el ciclo de la
 * RESERVA (crear, pagar, confirmar, reprogramar) y ya carga con eso.
 */
import { AppError, ERROR_CODES } from "@/lib/errors";
import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { alCumplirCita } from "./al-cumplir";
import { withUnitOfWork } from "@/lib/dal/unit-of-work";
import { SolicitudCitaRepository } from "@/lib/dal/repositories/solicitud-cita";
import { PerfilProfesionalRepository } from "@/lib/dal/repositories/perfil-profesional";
import { CodigoCitaRepository } from "@/lib/dal/repositories/codigo-cita";
import { programar, despacharEnvios } from "@/lib/notificaciones/motor";
import {
    emitirCodigo,
    verificarYUsar,
    puedeReemitir,
    ANTICIPACION_RECORDATORIO_MS,
    VIGENCIA_CODIGO_MS,
    type MotivoRechazo,
} from "./codigos";

/** Días sin cerrar tras los que la cita se autocierra (brief §3). */
export const DIAS_AUTOCIERRE = 5;
const DIAS_AUTOCIERRE_MS = DIAS_AUTOCIERRE * 24 * 60 * 60 * 1000;

export const EVENTO_RECORDATORIO = "cita.codigo.recordatorio";
export const EVENTO_AUTOCERRADA = "cita.autocerrada.padre";
export const EVENTO_NO_ASISTIO = "cita.no_asistio.padre";

/** Qué le decimos al profesional cuando el código no sirve. */
const MENSAJE_RECHAZO: Record<MotivoRechazo, string> = {
    sin_codigo: "Todavía no hay un código para esta cita. El padre puede pedirlo desde su cuenta.",
    expirado: "Ese código venció. Pedile al padre que solicite otro: llega al instante.",
    max_intentos: "Se agotaron los intentos con ese código. Pedile al padre que solicite otro.",
    incorrecto: "El código no coincide. Revisá los seis dígitos con el padre.",
    ya_usado: "Ese código ya se usó. Si la cita no quedó cerrada, avisá a soporte.",
};

function rechazo(motivo: MotivoRechazo): AppError {
    // 409 y no 400: el código puede ser correcto y aun así no servir (vencido,
    // usado). Es un conflicto de estado, no una petición mal formada.
    return new AppError(MENSAJE_RECHAZO[motivo], ERROR_CODES.CONFLICT, 409);
}

/** El perfil del profesional dueño de la solicitud, o 403. */
async function exigirDuenoDeLaCita(solicitudId: string, profesionalUsuarioId: string) {
    const solicitud = await new SolicitudCitaRepository().findById(solicitudId);
    if (!solicitud) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    const perfil = await new PerfilProfesionalRepository().findPorUsuarioId(profesionalUsuarioId);
    if (!perfil || perfil.id !== solicitud.profesionalId) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    return solicitud;
}

/**
 * El profesional digita el código de cita → la sesión ocurrió → `CUMPLIDA`.
 *
 * Con esto, por primera vez, ALGUIEN escribe `CUMPLIDA`. Hasta esta spec el
 * estado existía en el enum y no lo ponía nadie (candado de SPEC-425).
 */
export async function cerrarConCodigoDeCita(
    solicitudId: string,
    profesionalUsuarioId: string,
    codigo: string,
    ahora = new Date()
) {
    const solicitud = await exigirDuenoDeLaCita(solicitudId, profesionalUsuarioId);
    if (solicitud.estado !== "CONFIRMADA") {
        throw new AppError(
            "Solo se cierra una cita confirmada.",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const r = await verificarYUsar(solicitudId, "CITA", codigo, ahora);
    if (!r.ok) {
        await logAudit({
            accion: "CITA_PROFESIONAL_CODIGO_FALLIDO",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitudId,
            usuarioId: profesionalUsuarioId,
            // El código NO se audita, ni acertado ni fallido: el motivo alcanza
            // para investigar y el valor es un secreto de un solo uso.
            metadatos: { tipo: "CITA", motivo: r.motivo },
            ipAddress: "profesional",
            userAgent: "cita/cerrar",
        });
        throw rechazo(r.motivo);
    }

    const cerrada = await new SolicitudCitaRepository().marcarCumplidaSiConfirmada(solicitudId);
    if (!cerrada) {
        throw new AppError("La cita cambió de estado mientras se cerraba.", ERROR_CODES.CONFLICT, 409);
    }
    await logAudit({
        accion: "CITA_PROFESIONAL_CUMPLIDA",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: profesionalUsuarioId,
        metadatos: { codigoId: r.codigoId },
        ipAddress: "profesional",
        userAgent: "cita/cerrar",
    });

    // Punto de unión con SPEC-429 (las encuestas). Fuera de la transacción y
    // con el error contenido: una encuesta que no se activa no puede deshacer
    // una sesión que ocurrió de verdad — pero tampoco puede desaparecer sin
    // dejar rastro, que es la lección de I-294/I-295.
    try {
        await alCumplirCita(solicitudId);
    } catch (e) {
        logger.error("[SPEC-427] La cita cerró pero el enganche de encuestas falló", {
            solicitudId,
            error: e instanceof Error ? e.message : String(e),
        });
    }
    // El estado sale de la fila, no de un literal repetido acá: si algún día el
    // repositorio escribe otra cosa, la pantalla no puede seguir afirmando que
    // cerró. Un solo lugar dice cuál es el estado, y es la base.
    return { estado: cerrada.estado };
}

/**
 * El profesional declara que la familia no se presentó (brief §3).
 *
 * Es el otro estado de cierre, y va sin código a propósito: no hay nadie del
 * otro lado que pueda dictarlo. Por eso lo que lo sostiene no es una prueba sino
 * **la declaración cruzada**: SPEC-429 compara esto con lo que diga el padre en
 * su encuesta y, si se contradicen, el caso salta al Verificador.
 *
 * Consecuencia según el brief: el padre tiene UNA reprogramación sin costo con
 * el mismo profesional —el perjudicado fue él, que bloqueó una hora—. Ese
 * contador ya vive en `reprogramarPorPadre`. Acá no se mueve un peso: la plata
 * es de L7.
 */
export async function marcarNoAsistioElPadre(
    solicitudId: string,
    profesionalUsuarioId: string
) {
    const solicitud = await exigirDuenoDeLaCita(solicitudId, profesionalUsuarioId);
    if (solicitud.estado !== "CONFIRMADA") {
        throw new AppError(
            "Solo se declara la inasistencia de una cita confirmada.",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const repo = new SolicitudCitaRepository();
    const marcada = await repo.marcarNoAsistioPadreSiConfirmada(solicitudId);
    if (!marcada) {
        throw new AppError("La cita cambió de estado mientras se marcaba.", ERROR_CODES.CONFLICT, 409);
    }

    await logAudit({
        accion: "CITA_PROFESIONAL_NO_ASISTIO_PADRE",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: profesionalUsuarioId,
        ipAddress: "profesional",
        userAgent: "cita/no-asistio",
    });

    // El padre se entera por correo, no por descubrirlo en la pantalla. Es una
    // declaración sobre él hecha por otro: enterarse tarde es lo que convierte
    // un malentendido en un reclamo.
    const completa = await repo.findParaCodigo(solicitudId);
    if (completa) {
        const aviso = await programar({
            evento: EVENTO_NO_ASISTIO,
            sujetoTipo: "SolicitudCita",
            sujetoId: solicitudId,
            destinatarios: [
                {
                    usuarioId: completa.padreUsuario.id,
                    email: completa.padreUsuario.email,
                    rol: "PARENT",
                    variables: {
                        nombrePadre: completa.padreUsuario.nombre ?? "",
                        nombreProfesional: completa.profesional.nombreVisible,
                        horaCita: horaLegible(completa.franja.inicio),
                    },
                },
            ],
        });
        await despacharEnvios(aviso.envios ?? []);
    }

    // El cruce de SPEC-429 también arranca acá: la cita terminó, aunque haya
    // terminado mal, y las dos encuestas se activan igual.
    try {
        await alCumplirCita(solicitudId);
    } catch (e) {
        logger.error("[SPEC-427] La inasistencia quedó marcada pero el enganche de encuestas falló", {
            solicitudId,
            error: e instanceof Error ? e.message : String(e),
        });
    }

    return { estado: marcada.estado };
}

/**
 * El profesional digita el código de expediente → puede abrirlo.
 *
 * El permiso queda en la fila usada del código: hay acceso si existe un código
 * de EXPEDIENTE usado para esa solicitud. No se agrega una segunda verdad —
 * un booleano en la solicitud podría contradecir la traza que el brief exige.
 */
export async function abrirExpedienteConCodigo(
    solicitudId: string,
    profesionalUsuarioId: string,
    codigo: string,
    ahora = new Date()
) {
    const solicitud = await exigirDuenoDeLaCita(solicitudId, profesionalUsuarioId);
    if (!solicitud.expedienteCompartidoId) {
        throw new AppError(
            "El padre no compartió el expediente para esta cita.",
            ERROR_CODES.CONFLICT,
            409
        );
    }

    const r = await verificarYUsar(solicitudId, "EXPEDIENTE", codigo, ahora);
    if (!r.ok) {
        await logAudit({
            accion: "CITA_PROFESIONAL_CODIGO_FALLIDO",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitudId,
            usuarioId: profesionalUsuarioId,
            metadatos: { tipo: "EXPEDIENTE", motivo: r.motivo },
            ipAddress: "profesional",
            userAgent: "cita/abrir-expediente",
        });
        throw rechazo(r.motivo);
    }

    await logAudit({
        accion: "CITA_PROFESIONAL_EXPEDIENTE_ABIERTO",
        tipoRecurso: "Expediente",
        recursoId: solicitud.expedienteCompartidoId,
        usuarioId: profesionalUsuarioId,
        metadatos: { solicitudId, codigoId: r.codigoId },
        ipAddress: "profesional",
        userAgent: "cita/abrir-expediente",
    });
    return { expedienteId: solicitud.expedienteCompartidoId };
}

/**
 * ¿Este profesional puede leer el expediente de esta cita?
 * Sí solo si digitó el código: el acto del padre es lo que abre la puerta.
 */
export async function tieneAccesoAlExpediente(solicitudId: string): Promise<boolean> {
    const codigos = await new CodigoCitaRepository().listarPorSolicitud(solicitudId);
    return codigos.some((c) => c.tipo === "EXPEDIENTE" && c.usadoEn !== null);
}

/** Formato humano de la hora de la cita, para el correo. */
function horaLegible(d: Date): string {
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: "America/Bogota",
    }).format(d);
}

interface DatosParaAvisar {
    solicitudId: string;
    padre: { id: string; email: string; nombre: string | null };
    profesionalNombre: string;
    inicio: Date;
}

/**
 * Emite un código de cita y programa el correo que se lo lleva al padre.
 *
 * El correo va por el motor con `enviarEn`, así que sale solo a la hora
 * indicada — no hace falta un reloj nuevo. Y el código se crea CERCA de la
 * cita, no al confirmar días antes: cuanto menos tiempo exista, menos tiempo
 * hay para que sirva de algo si alguien lo ve donde no debe.
 */
async function emitirYProgramarRecordatorio(d: DatosParaAvisar, ahora: Date) {
    const enviarEn = new Date(d.inicio.getTime() - ANTICIPACION_RECORDATORIO_MS);
    // Si ya pasó la hora del recordatorio (una cita que arranca en 3 minutos),
    // el código vale desde ahora: lo que no puede es nacer vencido.
    const vigenteDesde = enviarEn > ahora ? enviarEn : ahora;
    const cuando = enviarEn > ahora ? enviarEn : ahora;

    // El código y su aviso NACEN JUNTOS o no nacen (SPEC-418 · I-295). Si se
    // guardara el código y el aviso no se encolara, la cita quedaría con código
    // emitido —y por eso fuera del barrido, que filtra por `codigos: none`—
    // pero el padre nunca lo recibiría: la cita no podría cerrarse jamás y
    // nadie se enteraría. Falla en cerrado y la próxima corrida reintenta.
    const { emitido, aviso } = await withUnitOfWork(async (tx) => {
        const emitido = await emitirCodigo({
            solicitudId: d.solicitudId,
            tipo: "CITA",
            vigenteDesde,
            tx,
        });

        const aviso = await programar(
            {
                evento: EVENTO_RECORDATORIO,
                sujetoTipo: "SolicitudCita",
                sujetoId: d.solicitudId,
                enviarEn: cuando,
                destinatarios: [
                    {
                        usuarioId: d.padre.id,
                        email: d.padre.email,
                        rol: "PARENT",
                        variables: {
                            nombrePadre: d.padre.nombre ?? "",
                            nombreProfesional: d.profesionalNombre,
                            horaCita: horaLegible(d.inicio),
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
                "No se pudo encolar el código al padre: falta la regla activa del motor. El código no se emitió.",
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
        recursoId: d.solicitudId,
        usuarioId: d.padre.id,
        metadatos: { tipo: "CITA", programadas: aviso.programadas },
        ipAddress: "worker",
        userAgent: "cita/codigo",
    });

    return { emitido, aviso };
}

/**
 * Barredor · el recordatorio con el código, 10 minutos antes.
 *
 * Idempotente por construcción: solo toma citas que **no tienen** código de
 * cita todavía (`codigos: { none: { tipo: "CITA" } }`), así que dos corridas
 * seguidas no emiten dos veces. La ventana se abre generosa hacia atrás para
 * que una corrida perdida no deje a un padre sin su código.
 */
export async function barrerRecordatoriosDeCita(ahora = new Date()) {
    const desde = new Date(ahora.getTime() - 60 * 60 * 1000);
    const hasta = new Date(ahora.getTime() + ANTICIPACION_RECORDATORIO_MS);
    const citas = await new SolicitudCitaRepository().listarConfirmadasPorArrancar(desde, hasta);

    let emitidos = 0;
    for (const c of citas) {
        const { aviso } = await emitirYProgramarRecordatorio(
            {
                solicitudId: c.id,
                padre: c.padreUsuario,
                profesionalNombre: c.profesional.nombreVisible,
                inicio: c.franja.inicio,
            },
            ahora
        );
        emitidos += 1;
        await despacharEnvios(aviso.envios ?? []);
    }
    return { emitidos };
}

/**
 * El padre pide otro código. El brief lo permite «las veces que haga falta».
 *
 * El tope de reemisiones no castiga al padre: frena que la pantalla se use como
 * máquina de mandar correos. Por eso es alto y por ventana.
 */
export async function pedirOtroCodigoDeCita(
    solicitudId: string,
    padreUsuarioId: string,
    ahora = new Date()
) {
    const solicitud = await new SolicitudCitaRepository().findParaCodigo(solicitudId);
    if (!solicitud) throw new AppError("Solicitud no encontrada", ERROR_CODES.NOT_FOUND, 404);
    if (solicitud.padreUsuarioId !== padreUsuarioId) {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
    if (solicitud.estado !== "CONFIRMADA") {
        throw new AppError(
            "Solo se piden códigos de una cita confirmada.",
            ERROR_CODES.CONFLICT,
            409
        );
    }
    if (!(await puedeReemitir(solicitudId, "CITA", ahora))) {
        throw new AppError(
            "Pediste muchos códigos en la última hora. Esperá un momento y volvé a intentar.",
            ERROR_CODES.RATE_LIMITED,
            429
        );
    }

    const { aviso } = await emitirYProgramarRecordatorio(
        {
            solicitudId,
            padre: solicitud.padreUsuario,
            profesionalNombre: solicitud.profesional.nombreVisible,
            // Pedido a mano: vale desde ya, no desde la hora agendada.
            inicio: new Date(ahora.getTime() + ANTICIPACION_RECORDATORIO_MS),
        },
        ahora
    );
    await despacharEnvios(aviso.envios ?? []);
    return { programadas: aviso.programadas };
}

/**
 * Barredor · autocierre a los 5 días (brief §3).
 *
 * «Sin cierre no hay giro. A los 5 días queda `SIN_CONFIRMAR`, no entra en el
 * pago ni suma en su marcador.» El costo de no cerrar cae sobre el profesional,
 * que es el incentivo buscado.
 *
 * La devolución de la plata al padre que el brief nombra en la misma fila es de
 * L7 y no se toca acá: esta spec deja la cita marcada y el incidente arriba de
 * la mesa del Verificador, que es lo que hace falta para poder devolverla.
 *
 * `autocerradaEn` es la marca que separa esta `SIN_CONFIRMAR` de la inicial —
 * la de una solicitud recién creada que nadie pagó (I-300). Sin esa columna la
 * cola del Verificador mezclaba las dos.
 */
export async function barrerAutocierre(ahora = new Date()) {
    const limite = new Date(ahora.getTime() - DIAS_AUTOCIERRE_MS);
    const repo = new SolicitudCitaRepository();
    const vencidas = await repo.listarConfirmadasVencidasParaAutocierre(limite);

    let autocerradas = 0;
    for (const c of vencidas) {
        await repo.marcarAutocerrada(c.id, ahora);
        autocerradas += 1;

        await logAudit({
            accion: "CITA_PROFESIONAL_AUTOCERRADA",
            tipoRecurso: "SolicitudCita",
            recursoId: c.id,
            metadatos: {
                diasSinCerrar: DIAS_AUTOCIERRE,
                profesionalId: c.profesional.id,
                finDeLaCita: c.franja.fin.toISOString(),
            },
            ipAddress: "worker",
            userAgent: "cita/autocierre",
        });

        // Al padre por correo; al administrador por la cola 2 del Verificador,
        // que es su canal real y queda hasta que alguien la resuelva. Un correo
        // más a una casilla compartida no es un aviso: es ruido que se pierde.
        const aviso = await programar({
            evento: EVENTO_AUTOCERRADA,
            sujetoTipo: "SolicitudCita",
            sujetoId: c.id,
            destinatarios: [
                {
                    usuarioId: c.padreUsuario.id,
                    email: c.padreUsuario.email,
                    rol: "PARENT",
                    variables: {
                        nombrePadre: c.padreUsuario.nombre ?? "",
                        nombreProfesional: c.profesional.nombreVisible,
                        horaCita: horaLegible(c.franja.inicio),
                        dias: DIAS_AUTOCIERRE,
                    },
                },
            ],
        });
        await despacharEnvios(aviso.envios ?? []);
    }
    return { autocerradas };
}
