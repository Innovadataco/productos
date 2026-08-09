import { logAudit } from "@/lib/audit";
import { logger } from "@/lib/logger";
import { AlertaColegioRepository } from "@/lib/dal/repositories/alerta-colegio";
import { IdentificadorEstudianteRepository } from "@/lib/dal/repositories/identificador-estudiante";
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
export type { EstadoAlertaColegio } from "@/lib/dal/repositories/alerta-colegio";
import type { EstadoAlertaColegio } from "@/lib/dal/repositories/alerta-colegio";

export interface AlertaColegioListado {
    id: string;
    identificador: string;
    relacion: string;
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

        // Búsqueda cross-tenant a propósito (excepción documentada en el repo):
        // hay que avisar a CADA colegio que registró el identificador.
        const identificadores = await new IdentificadorEstudianteRepository().buscarActivosPorValor(identificadorNormalizado);

        if (identificadores.length === 0) {
            logger.info(`[COLEGIO] Notificación omitida: sin identificadores activos para ${reporte.identificador}`);
            return;
        }

        const alertas = new AlertaColegioRepository();

        // SPEC-149: alertas creadas (id + colegio) para el pipeline de avisos.
        const alertasCreadas: { id: string; colegioId: string }[] = [];

        for (const identificador of identificadores) {
            const colegioId = identificador.estudiante.colegioId;
            const vigente = await colegioEstaVigente(colegioId);
            if (!vigente) {
                logger.info(`[COLEGIO] Notificación omitida: colegio ${colegioId} no está vigente`);
                continue;
            }

            try {
                const existente = await alertas.buscarExistente(colegioId, reporte.id, identificador.id);

                if (existente) {
                    continue;
                }

                const alerta = await alertas.crear({
                    colegioId,
                    reporteId: reporte.id,
                    identificadorEstudianteId: identificador.id,
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
                        identificadorEstudianteId: identificador.id,
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
        // reporte toque a varios estudiantes del colegio (misma entidadId).
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
 * identificador, relación, categoría del reporte, estado del reporte,
 * estado de la alerta y fecha de creación.
 */
export async function listarAlertasColegio(
    colegioId: string,
    estado?: EstadoAlertaColegio
): Promise<AlertaColegioListado[]> {
    const alertas = await new AlertaColegioRepository().listarPorColegio(colegioId, { estado });

    return alertas.map((alerta) => ({
        id: alerta.id,
        identificador: alerta.identificadorEstudiante.valor,
        relacion: alerta.identificadorEstudiante.etiquetaRelacion,
        categoria: alerta.reporte.clasificacion?.categoria ?? null,
        estadoReporte: alerta.reporte.estado,
        estadoAlerta: alerta.estado,
        creadoEn: alerta.creadoEn.toISOString(),
    }));
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
        valorAnterior: JSON.stringify({ estado: alerta.estado }),
        valorNuevo: JSON.stringify({ estado }),
        ipAddress,
        userAgent,
    });

    return actualizada;
}
