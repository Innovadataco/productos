import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { enviarAlertaColegio } from "@/lib/email";
import { getParametroSistemaValor } from "@/lib/parametros";
import { logger } from "@/lib/logger";
import { verificarVigenciaPorColegioId } from "./vigencia";
import type { AccionAudit, EstadoReporte, Prisma } from "@prisma/client";

const ESTADOS_VISIBLES: EstadoReporte[] = [
    "CLASIFICADO",
    "CORREGIDO",
    "REVISION_MANUAL",
    "POSIBLE_SPAM",
    "REQUIERE_ANONIMIZACION",
];

export type EstadoAlertaColegio = "nueva" | "vista" | "gestionada";

export interface AlertaColegioListado {
    id: string;
    identificador: string;
    relacion: string;
    categoria: string | null;
    estadoReporte: string;
    estadoAlerta: string;
    creadoEn: string;
}

function getClient(client?: Prisma.TransactionClient): Prisma.TransactionClient | typeof prisma {
    return client || prisma;
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
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: {
                id: true,
                identificador: true,
                estado: true,
                eliminado: true,
            },
        });
        if (!reporte || reporte.eliminado) {
            logger.info(`[COLEGIO] Notificación omitida: reporte ${reporteId} no existe o está eliminado`);
            return;
        }
        if (!ESTADOS_VISIBLES.includes(reporte.estado as EstadoReporte)) {
            logger.info(`[COLEGIO] Notificación omitida: estado ${reporte.estado} no visible`);
            return;
        }

        const identificadorNormalizado = reporte.identificador.trim().toLowerCase();

        const identificadores = await prisma.identificadorAlumno.findMany({
            where: {
                estado: "activo",
                valor: { equals: identificadorNormalizado, mode: "insensitive" },
            },
            include: {
                alumno: {
                    select: { colegioId: true },
                },
            },
        });

        if (identificadores.length === 0) {
            logger.info(`[COLEGIO] Notificación omitida: sin identificadores activos para ${reporte.identificador}`);
            return;
        }

        // Agrupar por colegio para enviar una sola notificación por colegio
        const alertasCreadasPorColegio = new Map<string, number>();

        for (const identificador of identificadores) {
            const colegioId = identificador.alumno.colegioId;
            const vigente = await colegioEstaVigente(colegioId);
            if (!vigente) {
                logger.info(`[COLEGIO] Notificación omitida: colegio ${colegioId} no está vigente`);
                continue;
            }

            try {
                const existente = await prisma.alertaColegio.findUnique({
                    where: {
                        colegioId_reporteId_identificadorAlumnoId: {
                            colegioId,
                            reporteId: reporte.id,
                            identificadorAlumnoId: identificador.id,
                        },
                    },
                });

                if (existente) {
                    continue;
                }

                const alerta = await prisma.alertaColegio.create({
                    data: {
                        colegioId,
                        reporteId: reporte.id,
                        identificadorAlumnoId: identificador.id,
                        estado: "nueva",
                    },
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
                        identificadorAlumnoId: identificador.id,
                        estado: alerta.estado,
                    }),
                    ipAddress: "worker",
                    userAgent: "worker",
                });

                alertasCreadasPorColegio.set(colegioId, (alertasCreadasPorColegio.get(colegioId) || 0) + 1);
            } catch (error) {
                logger.error(`[COLEGIO] Error creando alerta para colegio ${colegioId}:`, error);
            }
        }

        // Enviar notificaciones ciegas por colegio
        for (const [colegioId, cantidad] of alertasCreadasPorColegio.entries()) {
            await enviarNotificacionColegio(colegioId, cantidad).catch((err) => {
                logger.error(`[COLEGIO] Error enviando notificación a colegio ${colegioId}:`, err);
            });
        }
    } catch (error) {
        logger.error("[COLEGIO] Error en notificación de colegio:", error);
    }
}

/**
 * Envía un email genérico al SCHOOL_ADMIN del colegio si las notificaciones están
 * habilitadas y no hay cooldown activo. Nunca incluye datos del reporte.
 */
async function enviarNotificacionColegio(colegioId: string, novedades: number) {
    const globalEnabled = await getParametroSistemaValor("colegio.notificaciones.enabled");
    if (globalEnabled === "false") {
        logger.info(`[COLEGIO] Notificación omitida: colegio.notificaciones.enabled=false`);
        return;
    }

    const admin = await prisma.usuario.findFirst({
        where: { colegioId, rol: "SCHOOL_ADMIN", estado: "activo" },
        select: { id: true, email: true, ultimaNotificacionColegioEn: true },
    });
    if (!admin || !admin.email) {
        logger.info(`[COLEGIO] Notificación omitida: admin no encontrado o sin email para colegio ${colegioId}`);
        return;
    }

    const cooldownHoras = parseInt(
        (await getParametroSistemaValor("colegio.notificaciones.cooldown_horas")) || "24",
        10
    );
    const cooldownMs = (Number.isNaN(cooldownHoras) ? 24 : cooldownHoras) * 60 * 60 * 1000;
    const ahora = new Date();

    if (admin.ultimaNotificacionColegioEn && ahora.getTime() - admin.ultimaNotificacionColegioEn.getTime() < cooldownMs) {
        logger.info(`[COLEGIO] Notificación omitida: admin ${admin.id} en cooldown`);
        return;
    }

    logger.info(`[COLEGIO] Enviando alerta ciega a ${admin.email} (${novedades} novedades)`);
    await enviarAlertaColegio(admin.email, novedades);
    await prisma.usuario.update({
        where: { id: admin.id },
        data: { ultimaNotificacionColegioEn: ahora },
    });
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
    const alertas = await prisma.alertaColegio.findMany({
        where: {
            colegioId,
            ...(estado ? { estado } : {}),
            reporte: {
                eliminado: false,
            },
        },
        include: {
            identificadorAlumno: {
                select: {
                    valor: true,
                    etiquetaRelacion: true,
                },
            },
            reporte: {
                select: {
                    estado: true,
                    clasificacion: {
                        select: {
                            categoria: true,
                        },
                    },
                },
            },
        },
        orderBy: { creadoEn: "desc" },
    });

    return alertas.map((alerta) => ({
        id: alerta.id,
        identificador: alerta.identificadorAlumno.valor,
        relacion: alerta.identificadorAlumno.etiquetaRelacion,
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
    const alerta = await prisma.alertaColegio.findFirst({
        where: { id: alertaId, colegioId },
    });
    if (!alerta) {
        throw new Error("Alerta no encontrada");
    }
    if (alerta.estado === estado) {
        return alerta;
    }

    const actualizada = await prisma.alertaColegio.update({
        where: { id: alertaId },
        data: { estado },
    });

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
