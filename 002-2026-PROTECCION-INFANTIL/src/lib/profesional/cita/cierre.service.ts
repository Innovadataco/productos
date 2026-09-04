/**
 * SPEC-427 (A-75 · L6 · brief §9 momentos 6) · el cierre de la cita.
 *
 * Acá vive todo lo que pasa DESPUÉS de que la cita quedó confirmada: el envío
 * del código al padre, el momento en que el profesional lo digita para cerrar,
 * y el autocierre a los 5 días cuando nadie cerró nada.
 *
 * El código de EXPEDIENTE (la otra mitad del momento 6 del brief) sale a
 * SPEC-427b: media funcionalidad no entra a medias.
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
    validarCodigo,
    ANTICIPACION_RECORDATORIO_MS,
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
    sin_codigo: "Todavía no le llegó el código al padre. El correo sale 10 minutos antes de la cita.",
    // El código vive hasta pasada la sesión (B1), así que vencer es raro; si
    // pasa, no se promete un botón que hoy no existe: se resuelve con soporte.
    expirado: "Ese código venció. Escribí a soporte para reprogramar el cierre.",
    max_intentos: "Se agotaron los intentos con ese código. Revisalo con el padre o escribí a soporte.",
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

    const v = await validarCodigo(solicitudId, "CITA", codigo, ahora);
    if (!v.ok) {
        await logAudit({
            accion: "CITA_PROFESIONAL_CODIGO_FALLIDO",
            tipoRecurso: "SolicitudCita",
            recursoId: solicitudId,
            usuarioId: profesionalUsuarioId,
            // El código NO se audita, ni acertado ni fallido: el motivo alcanza
            // para investigar y el valor es un secreto de un solo uso.
            metadatos: { tipo: "CITA", motivo: v.motivo },
            ipAddress: "profesional",
            userAgent: "cita/cerrar",
        });
        throw rechazo(v.motivo);
    }

    // SPEC-427 (fix a) · consumir el código y escribir CUMPLIDA en la MISMA
    // transacción. Antes eran dos statements sueltos: si el segundo fallaba, el
    // código quedaba quemado y la cita sin cerrar — el padre no tenía cómo
    // reintentar. Ahora, o pasan los dos o no pasa ninguno.
    const cerrada = await withUnitOfWork(async (tx) => {
        const consumido = await new CodigoCitaRepository(tx).marcarUsadoSiLibre(v.codigoId, ahora);
        if (!consumido) throw rechazo("ya_usado");
        const fila = await new SolicitudCitaRepository(tx).marcarCumplidaSiConfirmada(solicitudId);
        if (!fila) {
            throw new AppError("La cita cambió de estado mientras se cerraba.", ERROR_CODES.CONFLICT, 409);
        }
        return fila;
    });

    await logAudit({
        accion: "CITA_PROFESIONAL_CUMPLIDA",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: profesionalUsuarioId,
        metadatos: { codigoId: v.codigoId },
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

    // SPEC-427 (fix c) · el cambio de estado y el aviso al padre, en la MISMA
    // transacción. Es una declaración sobre el padre hecha por otro: si el
    // estado se moviera y el aviso se perdiera, el padre nunca se enteraría y
    // nadie reintentaría (I-294/295). Encolado dentro de la tx (SPEC-418): si
    // la tx aborta, no queda un aviso de algo que no pasó.
    const completa = await new SolicitudCitaRepository().findParaCodigo(solicitudId);
    const { marcada, envios } = await withUnitOfWork(async (tx) => {
        const fila = await new SolicitudCitaRepository(tx).marcarNoAsistioPadreSiConfirmada(solicitudId);
        if (!fila) {
            throw new AppError("La cita cambió de estado mientras se marcaba.", ERROR_CODES.CONFLICT, 409);
        }
        let envios: Awaited<ReturnType<typeof programar>>["envios"] = [];
        if (completa) {
            const aviso = await programar(
                {
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
                },
                { tx }
            );
            // SPEC-427 (B5): si el aviso no se encoló, la tx ABORTA. Es una
            // declaración sobre el padre; moverla sin avisarle es exactamente
            // I-294/295. `cita.no_asistio.padre` es bloqueante en el guardián,
            // así que un deploy sin la regla se detiene en la compuerta; y si
            // igual faltara en runtime, esto revierte en vez de mentir.
            if (aviso.programadas === 0) {
                throw new AppError(
                    "No se pudo encolar el aviso al padre: falta la regla activa del motor. La inasistencia no se marcó.",
                    ERROR_CODES.INTERNAL_ERROR,
                    500,
                );
            }
            envios = aviso.envios ?? [];
        }
        return { marcada: fila, envios };
    });

    // Ya committeado: se despierta al worker. Si esto falla no se pierde nada —
    // la fila quedó ENCOLADA en la transacción y el polling la recoge.
    await despacharEnvios(envios ?? []);

    await logAudit({
        accion: "CITA_PROFESIONAL_NO_ASISTIO_PADRE",
        tipoRecurso: "SolicitudCita",
        recursoId: solicitudId,
        usuarioId: profesionalUsuarioId,
        ipAddress: "profesional",
        userAgent: "cita/no-asistio",
    });

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
    /** SPEC-427 (B1): la vigencia del código se ancla al fin de la franja. */
    fin: Date;
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
            franjaFin: d.fin,
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
    let errores = 0;
    for (const c of citas) {
        // SPEC-427 (fix e) · una cita rota no puede frenar a las demás. Se
        // registra y se sigue; el barrido termina con la cuenta de cuántas
        // fallaron para que un problema sistemático se vea.
        try {
            const { aviso } = await emitirYProgramarRecordatorio(
                {
                    solicitudId: c.id,
                    padre: c.padreUsuario,
                    profesionalNombre: c.profesional.nombreVisible,
                    inicio: c.franja.inicio,
                    fin: c.franja.fin,
                },
                ahora
            );
            emitidos += 1;
            await despacharEnvios(aviso.envios ?? []);
        } catch (e) {
            errores += 1;
            logger.error("[SPEC-427] No se pudo emitir el código de una cita", {
                solicitudId: c.id,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    // `encontradas` distingue «no había trabajo» de «falló todo»: cero emitidos
    // con cero encontradas es un barrido sano; con encontradas>0 es una alarma.
    return { encontradas: citas.length, emitidos, errores };
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
    let saltadas = 0;
    let errores = 0;
    for (const c of vencidas) {
        // SPEC-427 (fix e) · una cita rota no frena el barrido.
        try {
            // SPEC-427 (fix b, c) · el cambio de estado y el aviso, atómicos.
            // La guardia de estado vive en el WHERE de `marcarAutocerrada`: si
            // el profesional cerró la cita entre el `listar` y esto, NO se pisa
            // su CUMPLIDA/NO_ASISTIO — `movida` sale false y no se avisa nada.
            const { movida, envios } = await withUnitOfWork(async (tx) => {
                const movida = await new SolicitudCitaRepository(tx).marcarAutocerrada(c.id, ahora);
                if (!movida) return { movida: false, envios: [] as Awaited<ReturnType<typeof programar>>["envios"] };

                const aviso = await programar(
                    {
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
                    },
                    { tx }
                );
                if (aviso.programadas === 0) {
                    // SPEC-427 (B5): NO se commitea un autocierre sin avisar al
                    // padre. Se lanza dentro de la tx → el estado revierte a
                    // CONFIRMADA, el barrido diario lo reintenta, y el `errores`
                    // del try/catch lo cuenta (nada de resumen verde sobre un
                    // padre sin avisar). La regla es bloqueante en el guardián.
                    throw new AppError(
                        "Cita autocerrada sin aviso al padre: falta la regla activa del motor.",
                        ERROR_CODES.INTERNAL_ERROR,
                        500,
                    );
                }
                return { movida: true, envios: aviso.envios ?? [] };
            });

            if (!movida) {
                saltadas += 1; // la cerró alguien antes; no es un error, pero se cuenta
                continue;
            }

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
            // que es su canal real y queda hasta que alguien la resuelva.
            await despacharEnvios(envios ?? []);
        } catch (e) {
            errores += 1;
            logger.error("[SPEC-427] No se pudo autocerrar una cita", {
                solicitudId: c.id,
                error: e instanceof Error ? e.message : String(e),
            });
        }
    }
    return { encontradas: vencidas.length, autocerradas, saltadas, errores };
}
