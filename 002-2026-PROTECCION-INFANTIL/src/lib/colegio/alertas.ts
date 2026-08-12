import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
import { IdentificadorProfesorRepository } from "@/lib/dal/repositories/identificador-profesor";
import { IdentificadorAcudienteRepository } from "@/lib/dal/repositories/identificador-acudiente";
import { ReporteRepository } from "@/lib/dal/repositories/reporte";
import { registrarEventoAviso, evaluarUmbralesPorAlerta } from "./avisos";
import { verificarVigenciaPorColegioId } from "./vigencia";
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

        // SPEC-165: búsqueda cross-tenant a propósito en los tres tipos de sujeto.
        // Cada repo documenta la excepción; fallo en uno no impide los otros.
        const [identificadoresEstudiante, identificadoresProfesor, identificadoresAcudiente] = await Promise.all([
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
        ]);

        if (
            identificadoresEstudiante.length === 0 &&
            identificadoresProfesor.length === 0 &&
            identificadoresAcudiente.length === 0
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

                const alerta = await alertas.crear({ colegioId, reporteId: reporte.id, ...input });

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
                        estado: alerta.estado,
                    }),
                    ipAddress: "worker",
                    userAgent: "worker",
                });

                alertasCreadas.push({ id: alerta.id, colegioId });
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

    return actualizada;
}
