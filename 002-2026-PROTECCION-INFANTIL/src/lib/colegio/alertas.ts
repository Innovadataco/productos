import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AppError, ERROR_CODES } from "@/lib/errors";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { IdentificadorProfesorRepository } from "@/lib/dal/repositories/identificador-profesor";
import { IdentificadorIntegranteComiteRepository } from "@/lib/dal/repositories/identificador-integrante-comite";
import { IdentificadorAcudienteRepository } from "@/lib/dal/repositories/identificador-acudiente";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { EventoMatchRepository } from "@/lib/dal/repositories/evento-match";
import { registrarEventoAviso, evaluarUmbralesPorAlerta } from "./avisos";
import { verificarVigenciaPorColegioId } from "./vigencia";
import { calcularPrioridadYSLA } from "./alertas-prioridad";
import { crearNotificacionDesdeAlerta } from "./notificaciones";
import type { AccionAudit, EstadoReporte } from "@prisma/client";

const ESTADOS_VISIBLES: EstadoReporte[] = [
    "CLASIFICADO",
    "CORREGIDO",
    "REVISION_MANUAL",
    "POSIBLE_SPAM",
    "REQUIERE_ANONIMIZACION",
];

// SPEC-134 (E-1): el acceso a datos vive en los repos del DAL (tenant obligatorio);
// la lógica de negocio (dedupe, cooldown, mapeo a campos no sensibles) queda aquí.
export type { EstadoAlertaColegio, TipoSujeto } from "@/lib/dal/repositories/alerta-colegio";
import type { EstadoAlertaColegio, TipoSujeto, CrearAlertaInput } from "@/lib/dal/repositories/alerta-colegio";

export interface AlertaColegioListado {
    id: string;
    tipoSujeto: TipoSujeto;
    identificador: string | null;
    relacion: string | null;
    sujetoNombre: string | null;
    categoria: string | null;
    estadoReporte: string;
    estadoAlerta: string;
    prioridad: string;
    vencimientoSla: string;
    asignadoA: { id: string; nombre: string | null; email: string } | null;
    creadoEn: string;
}

/**
 * Verifica que el colegio esté activo y dentro del rango de vigencia del servicio.
 */
async function colegioEstaVigente(colegioId: string): Promise<boolean> {
    const vigencia = await verificarVigenciaPorColegioId(colegioId);
    return vigencia.vigente;
}

/**
 * Cuando un reporte visible menciona un identificador registrado por un colegio,
 * crea una alerta anonimizada para ese colegio. Si ya existe una alerta para la
 * combinación (colegio, reporte, identificador), no crea duplicados.
 *
 * El error se captura y loguea sin interrumpir el flujo del worker.
 */
export async function notificarColegioSiCorresponde(reporteId: string) {
    try {
        const reporte = await new ReporteRepository().findEstadoParaNotificacion(reporteId);
        if (!reporte || reporte.eliminado) {
            logger.info(`[COLEGIO] Notificación omitida: reporte ${reporteId} no existe o está eliminado`);
            return;
        }
        if (!ESTADOS_VISIBLES.includes(reporte.estado as EstadoReporte)) {
            logger.info(`[COLEGIO] Notificación omitida: estado ${reporte.estado} no visible`);
            return;
        }

        const identificadorNormalizado = reporte.identificador.trim().toLowerCase();

        // SPEC-166: cálculo determinista de prioridad/SLA a partir de clasificación y match.
        const eventoMatch = await new EventoMatchRepository().porReporteIdAgregado(reporte.id);
        const { prioridad, vencimientoSla } = calcularPrioridadYSLA(
            reporte.creadoEn,
            reporte.clasificacion
                ? {
                    categoria: reporte.clasificacion.categoria,
                    confianza: reporte.clasificacion.confianza,
                    posibleAgresorPar: reporte.clasificacion.posibleAgresorPar,
                }
                : null,
            eventoMatch ? { conteoAcumulado: eventoMatch.conteoAcumulado, interCiudad: eventoMatch.interCiudad } : null
        );

        // SPEC-165 · ampliado SPEC-380 PR B: búsqueda cross-tenant en los CUATRO
        // tipos de sujeto. Cada repo documenta su excepción; fallo en uno no
        // impide los otros. El integrante del comité entra igual que los demás.
        const [
            identificadoresEstudiante,
            identificadoresProfesor,
            identificadoresAcudiente,
            identificadoresIntegrante,
        ] = await Promise.all([
            new IdentificadorEstudianteRepository().buscarActivosPorValor(identificadorNormalizado).catch((err) => {
                logger.error("[COLEGIO] Error buscando identificadores de estudiante:", err);
                return [];
            }),
            new IdentificadorProfesorRepository().buscarActivosPorValor(identificadorNormalizado).catch((err) => {
                logger.error("[COLEGIO] Error buscando identificadores de profesor:", err);
                return [];
            }),
            new IdentificadorAcudienteRepository().buscarActivosPorValor(identificadorNormalizado).catch((err) => {
                logger.error("[COLEGIO] Error buscando identificadores de acudiente:", err);
                return [];
            }),
            new IdentificadorIntegranteComiteRepository().buscarActivosPorValor(identificadorNormalizado).catch((err) => {
                logger.error("[COLEGIO] Error buscando identificadores de integrante del comité:", err);
                return [];
            }),
        ]);

        if (
            identificadoresEstudiante.length === 0 &&
            identificadoresProfesor.length === 0 &&
            identificadoresAcudiente.length === 0 &&
            identificadoresIntegrante.length === 0
        ) {
            logger.info(`[COLEGIO] Notificación omitida: sin identificadores activos para ${reporte.identificador}`);
            return;
        }

        const alertas = new AlertaColegioRepository();

        // SPEC-149: alertas creadas (id + colegio) para el pipeline de avisos.
        const alertasCreadas: { id: string; colegioId: string }[] = [];

        // SPEC-165: candidatos de alerta normalizados (colegioId + input de creación).
        const candidatos: { colegioId: string; input: CrearAlertaInput }[] = [];

        for (const identificador of identificadoresEstudiante) {
            candidatos.push({
                colegioId: identificador.estudiante.colegioId,
                input: { tipoSujeto: "ESTUDIANTE", identificadorEstudianteId: identificador.id },
            });
        }
        for (const identificador of identificadoresProfesor) {
            candidatos.push({
                colegioId: identificador.profesor.colegioId,
                input: { tipoSujeto: "PROFESOR", identificadorProfesorId: identificador.id },
            });
        }
        for (const identificador of identificadoresAcudiente) {
            const colegioId = identificador.acudiente.estudiante.colegioId;
            candidatos.push({
                colegioId,
                input: { tipoSujeto: "ACUDIENTE", identificadorAcudienteId: identificador.id },
            });
        }
        for (const identificador of identificadoresIntegrante) {
            // El colegioId del integrante viene por su cuenta del comité
            // (`Usuario.comiteColegioId`). Si un integrante quedó sin colegio
            // (borde raro), se ignora — no se emite alerta en el vacío.
            const colegioId = identificador.integrante.comite.comiteColegioId;
            if (!colegioId) continue;
            candidatos.push({
                colegioId,
                input: { tipoSujeto: "INTEGRANTE_COMITE", identificadorIntegranteComiteId: identificador.id },
            });
        }

        for (const candidato of candidatos) {
            const { colegioId, input } = candidato;
            const vigente = await colegioEstaVigente(colegioId);
            if (!vigente) {
                logger.info(`[COLEGIO] Notificación omitida: colegio ${colegioId} no está vigente`);
                continue;
            }

            try {
                const existente = await alertas.buscarExistente(colegioId, reporte.id, input);
                if (existente) {
                    continue;
                }

                const alerta = await alertas.crear({
                    colegioId,
                    reporteId: reporte.id,
                    prioridad,
                    vencimientoSla,
                    ...input,
                });

                await logAudit({
                    accion: "COLEGIO_ALERTA_CREADA" as AccionAudit,
                    tipoRecurso: "AlertaColegio",
                    recursoId: alerta.id,
                    usuarioId: undefined,
                    colegioId,
                    valorNuevo: JSON.stringify({
                        colegioId,
                        reporteId: reporte.id,
                        tipoSujeto: alerta.tipoSujeto,
                        identificadorEstudianteId:
                            alerta.tipoSujeto === "ESTUDIANTE" ? alerta.identificadorEstudianteId : null,
                        identificadorProfesorId: alerta.tipoSujeto === "PROFESOR" ? alerta.identificadorProfesorId : null,
                        identificadorAcudienteId:
                            alerta.tipoSujeto === "ACUDIENTE" ? alerta.identificadorAcudienteId : null,
                        // SPEC-380 (PR B): 4º sujeto — el FK correspondiente.
                        identificadorIntegranteComiteId:
                            alerta.tipoSujeto === "INTEGRANTE_COMITE" ? alerta.identificadorIntegranteComiteId : null,
                        estado: alerta.estado,
                    }),
                    ipAddress: "worker",
                    userAgent: "worker",
                });

                alertasCreadas.push({ id: alerta.id, colegioId });

                // SPEC-169: notificación in-app independiente del email (nunca bloquea).
                crearNotificacionDesdeAlerta(colegioId, alerta.id, "ALERTA_NUEVA").catch((err) => {
                    logger.error(`[COLEGIO] Error creando notificación in-app para alerta ${alerta.id}:`, err);
                });
            } catch (error) {
                logger.error(`[COLEGIO] Error creando alerta para colegio ${colegioId}:`, error);
            }
        }

        // SPEC-149 (FR-002): el email genérico inline viejo (enviarNotificacionColegio,
        // cooldown 24 h) queda SUPERADO por el pipeline de avisos encolado — cero
        // doble email por construcción: aquí solo se ENCOLA (nunca se envía inline)
        // y la idempotencia real vive en la constraint de RegistroAvisoColegio.
        // REPORTE_NUEVO se avisa UNA vez por (colegio, reporte, día) aunque el
        // reporte toque a varios sujetos del colegio (misma entidadId).
        for (const alerta of alertasCreadas) {
            await registrarEventoAviso({
                colegioId: alerta.colegioId,
                tipoEvento: "REPORTE_NUEVO",
                entidadId: reporte.id,
            }).catch((err) => {
                logger.error(`[COLEGIO] Error registrando aviso REPORTE_NUEVO para colegio ${alerta.colegioId}:`, err);
            });
            await evaluarUmbralesPorAlerta(alerta.id).catch((err) => {
                logger.error(`[COLEGIO] Error evaluando umbrales de aviso para alerta ${alerta.id}:`, err);
            });
        }
    } catch (error) {
        logger.error("[COLEGIO] Error en notificación de colegio:", error);
    }
}

/**
 * Lista las alertas de un colegio. Solo expone campos no sensibles:
 * tipo de sujeto, identificador (solo estudiante), nombre del sujeto,
 * relación, categoría del reporte, estado del reporte, estado de la alerta
 * y fecha de creación.
 */
export async function listarAlertasColegio(
    colegioId: string,
    estado?: EstadoAlertaColegio,
    tipoSujeto?: TipoSujeto
): Promise<AlertaColegioListado[]> {
    const alertas = await new AlertaColegioRepository().listarPorColegio(colegioId, { estado, tipoSujeto });

    return alertas.map((alerta) => {
        let identificador: string | null = null;
        let relacion: string | null = null;
        let sujetoNombre: string | null = null;

        if (alerta.tipoSujeto === "ESTUDIANTE" && alerta.identificadorEstudiante) {
            identificador = alerta.identificadorEstudiante.valor;
            relacion = alerta.identificadorEstudiante.etiquetaRelacion;
            sujetoNombre = `${alerta.identificadorEstudiante.estudiante.nombre} ${alerta.identificadorEstudiante.estudiante.apellidos}`.trim();
        } else if (alerta.tipoSujeto === "PROFESOR" && alerta.identificadorProfesor) {
            relacion = "PROFESOR";
            sujetoNombre = `${alerta.identificadorProfesor.profesor.nombre} ${alerta.identificadorProfesor.profesor.apellidos}`.trim();
        } else if (alerta.tipoSujeto === "ACUDIENTE" && alerta.identificadorAcudiente) {
            relacion = alerta.identificadorAcudiente.acudiente.relacion;
            sujetoNombre = alerta.identificadorAcudiente.acudiente.nombre;
        } else if (alerta.tipoSujeto === "INTEGRANTE_COMITE" && alerta.identificadorIntegranteComite) {
            // SPEC-380 (PR B): integrante adulto — nombre + cargo (si lo tiene).
            identificador = alerta.identificadorIntegranteComite.valor;
            relacion = alerta.identificadorIntegranteComite.integrante.cargo ?? "INTEGRANTE_COMITE";
            sujetoNombre = `${alerta.identificadorIntegranteComite.integrante.nombres} ${alerta.identificadorIntegranteComite.integrante.apellidos}`.trim();
        }

        return {
            id: alerta.id,
            tipoSujeto: alerta.tipoSujeto as TipoSujeto,
            identificador,
            relacion,
            sujetoNombre,
            categoria: alerta.reporte.clasificacion?.categoria ?? null,
            estadoReporte: alerta.reporte.estado,
            estadoAlerta: alerta.estado,
            prioridad: alerta.prioridad,
            vencimientoSla: alerta.vencimientoSla.toISOString(),
            asignadoA: alerta.asignadoA
                ? { id: alerta.asignadoA.id, nombre: alerta.asignadoA.nombre, email: alerta.asignadoA.email }
                : null,
            creadoEn: alerta.creadoEn.toISOString(),
        };
    });
}

/**
 * Cambia el estado de una alerta de colegio. Valida que la alerta pertenezca
 * al colegio indicado. Registra auditoría de la acción.
 */
export async function cambiarEstadoAlerta(
    alertaId: string,
    colegioId: string,
    estado: EstadoAlertaColegio,
    request?: Request
) {
    const alertas = new AlertaColegioRepository();
    const alerta = await alertas.obtenerPorId(colegioId, alertaId);
    if (!alerta) {
        throw new Error("Alerta no encontrada");
    }
    if (alerta.estado === estado) {
        return alerta;
    }

    const actualizada = await alertas.cambiarEstado(colegioId, alertaId, estado);

    const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    await logAudit({
        accion: "COLEGIO_ALERTA_ESTADO" as AccionAudit,
        tipoRecurso: "AlertaColegio",
        recursoId: alertaId,
        colegioId: alerta.colegioId,
        valorAnterior: JSON.stringify({ estado: alerta.estado, tipoSujeto: alerta.tipoSujeto }),
        valorNuevo: JSON.stringify({ estado, tipoSujeto: alerta.tipoSujeto }),
        ipAddress,
        userAgent,
    });

    // SPEC-169: notificación in-app cuando la alerta pasa a gestionada o escalada.
    if (estado === "gestionada" || estado === "escalada") {
        const tipoNotificacion = estado === "gestionada" ? "ALERTA_GESTIONADA" : "ALERTA_ESCALADA";
        crearNotificacionDesdeAlerta(alerta.colegioId, alertaId, tipoNotificacion).catch((err) => {
            logger.error(`[COLEGIO] Error creando notificación in-app por cambio de estado ${estado}:`, err);
        });
    }

    return actualizada;
}

import {
    AlertaColegioBandejaRepository,
    type FiltrosBandeja,
    type Paginacion,
} from "@/lib/dal/repositories/alerta-colegio-bandeja";

export type { FiltrosBandeja, Paginacion } from "@/lib/dal/repositories/alerta-colegio-bandeja";

/** SPEC-166: listado de bandeja "nivel dios" para el colegio. */
export async function listarBandejaAlertasColegio(
    colegioId: string,
    filtros: FiltrosBandeja = {},
    paginacion: Paginacion = { page: 1, pageSize: 25 }
) {
    const repo = new AlertaColegioBandejaRepository();
    const resultado = await repo.listarBandeja(colegioId, filtros, paginacion);

    const items: AlertaColegioListado[] = resultado.items.map((alerta) => {
        let identificador: string | null = null;
        let relacion: string | null = null;
        let sujetoNombre: string | null = null;

        if (alerta.tipoSujeto === "ESTUDIANTE" && alerta.identificadorEstudiante) {
            identificador = alerta.identificadorEstudiante.valor;
            relacion = alerta.identificadorEstudiante.etiquetaRelacion;
            sujetoNombre = `${alerta.identificadorEstudiante.estudiante.nombre} ${alerta.identificadorEstudiante.estudiante.apellidos}`.trim();
        } else if (alerta.tipoSujeto === "PROFESOR" && alerta.identificadorProfesor) {
            relacion = "PROFESOR";
            sujetoNombre = `${alerta.identificadorProfesor.profesor.nombre} ${alerta.identificadorProfesor.profesor.apellidos}`.trim();
        } else if (alerta.tipoSujeto === "ACUDIENTE" && alerta.identificadorAcudiente) {
            relacion = alerta.identificadorAcudiente.acudiente.relacion;
            sujetoNombre = alerta.identificadorAcudiente.acudiente.nombre;
        } else if (alerta.tipoSujeto === "INTEGRANTE_COMITE" && alerta.identificadorIntegranteComite) {
            // SPEC-380 (PR B): integrante adulto — nombre + cargo (si lo tiene).
            identificador = alerta.identificadorIntegranteComite.valor;
            relacion = alerta.identificadorIntegranteComite.integrante.cargo ?? "INTEGRANTE_COMITE";
            sujetoNombre = `${alerta.identificadorIntegranteComite.integrante.nombres} ${alerta.identificadorIntegranteComite.integrante.apellidos}`.trim();
        }

        return {
            id: alerta.id,
            tipoSujeto: alerta.tipoSujeto as TipoSujeto,
            identificador,
            relacion,
            sujetoNombre,
            categoria: alerta.reporte.clasificacion?.categoria ?? null,
            estadoReporte: alerta.reporte.estado,
            estadoAlerta: alerta.estado,
            prioridad: alerta.prioridad,
            vencimientoSla: alerta.vencimientoSla.toISOString(),
            asignadoA: alerta.asignadoA
                ? { id: alerta.asignadoA.id, nombre: alerta.asignadoA.nombre, email: alerta.asignadoA.email }
                : null,
            creadoEn: alerta.creadoEn.toISOString(),
        };
    });

    return { items, total: resultado.total, page: resultado.page, pageSize: resultado.pageSize };
}

/** SPEC-166: asigna (o desasigna) una alerta a un usuario del colegio. */
export async function asignarAlerta(
    colegioId: string,
    alertaId: string,
    asignadoAId: string | null,
    actorId: string,
    request?: Request
) {
    const repo = new AlertaColegioBandejaRepository();
    const alerta = await repo.asignar(colegioId, alertaId, asignadoAId);

    const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    await logAudit({
        accion: "COLEGIO_ALERTA_ASIGNADA" as AccionAudit,
        tipoRecurso: "AlertaColegio",
        recursoId: alertaId,
        usuarioId: actorId,
        colegioId,
        valorAnterior: JSON.stringify({ asignadoAId: alerta.asignadoAId }),
        valorNuevo: JSON.stringify({ asignadoAId }),
        ipAddress,
        userAgent,
    });

    return alerta;
}

/** SPEC-166: escala una alerta a estado "escalada". */
export async function escalarAlerta(colegioId: string, alertaId: string, actorId: string, request?: Request) {
    const repoAlertas = new AlertaColegioRepository();
    const alerta = await repoAlertas.obtenerPorId(colegioId, alertaId);
    if (!alerta) {
        throw new AppError("Alerta no encontrada", ERROR_CODES.NOT_FOUND, 404);
    }
    if (alerta.estado === "escalada") {
        return alerta;
    }

    const actualizada = await repoAlertas.cambiarEstado(colegioId, alertaId, "escalada");

    const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    await logAudit({
        accion: "COLEGIO_ALERTA_ESCALADA" as AccionAudit,
        tipoRecurso: "AlertaColegio",
        recursoId: alertaId,
        usuarioId: actorId,
        colegioId,
        valorAnterior: JSON.stringify({ estado: alerta.estado }),
        valorNuevo: JSON.stringify({ estado: "escalada" }),
        ipAddress,
        userAgent,
    });

    return actualizada;
}

export type AccionLote = "vista" | "gestionada" | "escalada" | "cerrada" | "asignar" | "desasignar";

/** SPEC-166: aplica una acción a un lote de alertas del colegio. */
export async function aplicarAccionEnLote(
    colegioId: string,
    ids: string[],
    accion: AccionLote,
    actorId: string,
    payload: { asignadoAId?: string } = {},
    request?: Request
) {
    if (ids.length === 0) {
        return { afectadas: 0, accion };
    }

    const repoBandeja = new AlertaColegioBandejaRepository();
    const repoAlertas = new AlertaColegioRepository();
    const alertas = await repoBandeja.listarPorIds(colegioId, ids);
    const idsValidos = new Set(alertas.map((a) => a.id));

    let afectadas = 0;
    const ipAddress = request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown";
    const userAgent = request?.headers.get("user-agent") || "unknown";

    if (accion === "asignar") {
        for (const id of idsValidos) {
            await repoBandeja.asignar(colegioId, id, payload.asignadoAId ?? null);
            afectadas += 1;
        }
    } else if (accion === "desasignar") {
        for (const id of idsValidos) {
            await repoBandeja.asignar(colegioId, id, null);
            afectadas += 1;
        }
    } else {
        for (const id of idsValidos) {
            await repoAlertas.cambiarEstado(colegioId, id, accion as EstadoAlertaColegio);
            afectadas += 1;
        }
    }

    await logAudit({
        // SPEC-173 (H01): el batch 500 del CEO venía de aquí — la acción dinámica
        // `COLEGIO_ALERTA_LOTE_${accion}` no existe en el enum AccionAudit y Prisma
        // la rechazaba. Se audita con la acción canónica de cambio de estado y el
        // detalle del lote queda en valorNuevo.
        accion: "COLEGIO_ALERTA_ESTADO",
        tipoRecurso: "AlertaColegio",
        recursoId: Array.from(idsValidos).join(","),
        usuarioId: actorId,
        colegioId,
        valorNuevo: JSON.stringify({ accion, ids: Array.from(idsValidos), asignadoAId: payload.asignadoAId }),
        ipAddress,
        userAgent,
    });

    return { afectadas, accion };
}
