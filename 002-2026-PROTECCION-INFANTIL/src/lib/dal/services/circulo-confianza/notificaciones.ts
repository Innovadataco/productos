/**
 * SPEC-135 (E-2) + SPEC-308 (A-50): notificación del círculo cuando un reporte
 * visible toca un identificador del círculo de un usuario. Reemplaza la alerta
 * ciega por una alerta enriquecida con contexto real (contacto, identificador,
 * plataforma, categoría, total reportes, link al expediente).
 */
import { prisma } from "@/lib/prisma";
import { getParametroSistemaValor } from "@/lib/parametros";
import { enviarAlertaCirculoConfianzaEnriquecida } from "@/lib/email";
import type { EstadoReporte } from "@prisma/client";
import { logger } from "@/lib/logger";
import { ESTADOS_VISIBLES } from "./tipos";

async function obtenerNombrePlataforma(
    plataformaId: string | null | undefined,
    otraPlataforma: string | null | undefined
): Promise<string> {
    if (plataformaId) {
        const plataforma = await prisma.plataforma.findUnique({
            where: { id: plataformaId },
            select: { nombre: true },
        });
        if (plataforma?.nombre) return plataforma.nombre;
    }
    if (otraPlataforma) return otraPlataforma;
    return "Plataforma no especificada";
}

async function obtenerCategoriaReporte(reporteId: string): Promise<string | null> {
    const clasificacion = await prisma.clasificacionIA.findUnique({
        where: { reporteId },
        select: { categoria: true },
    });
    return clasificacion?.categoria ?? null;
}

async function contarReportesVisibles(identificador: string): Promise<number> {
    const reportes = await prisma.reporte.findMany({
        where: {
            identificador,
            eliminado: false,
            estado: { in: ESTADOS_VISIBLES },
        },
        select: { id: true },
    });
    return reportes.length;
}

/**
 * Evalúa si un reporte debe notificar a los usuarios que tienen contactos de confianza
 * asociados al mismo identificador. Respeta la preferencia de notificaciones del usuario,
 * el flag global de notificaciones y un periodo de cooldown entre alertas. Envía un email
 * enriquecido con contexto real y actualiza la marca temporal de la última notificación.
 * Cualquier error se captura y se loguea sin interrumpir el flujo.
 *
 * @param reporteId - UUID del reporte que puede generar notificaciones.
 */
export async function notificarCambioCirculoSiCorresponde(reporteId: string) {
    try {
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: {
                id: true,
                identificador: true,
                estado: true,
                eliminado: true,
                plataformaId: true,
                otraPlataforma: true,
            },
        });
        if (!reporte || reporte.eliminado) {
            logger.info(`[CIRCULO] Notificación omitida: reporte ${reporteId} no existe o está eliminado`);
            return;
        }
        if (!ESTADOS_VISIBLES.includes(reporte.estado as EstadoReporte)) {
            logger.info(`[CIRCULO] Notificación omitida: estado ${reporte.estado} no visible`);
            return;
        }

        const globalEnabled = await getParametroSistemaValor("circulo.notificaciones.enabled");
        if (globalEnabled === "false") {
            logger.info("[CIRCULO] Notificación omitida: circulo.notificaciones.enabled=false");
            return;
        }

        const cooldownHoras = parseInt(
            (await getParametroSistemaValor("circulo.notificaciones.cooldown_horas")) || "24",
            10
        );
        const cooldownMs = (Number.isNaN(cooldownHoras) ? 24 : cooldownHoras) * 60 * 60 * 1000;
        const ahora = new Date();

        const contactos = await prisma.contactoConfianza.findMany({
            where: {
                activo: true,
                identificadores: {
                    some: {
                        valor: reporte.identificador,
                        activo: true,
                    },
                },
            },
            include: {
                usuario: {
                    select: {
                        id: true,
                        email: true,
                        notificacionesCirculo: true,
                        ultimaNotificacionCirculoEn: true,
                    },
                },
                identificadores: {
                    where: { activo: true },
                    select: { valor: true, plataformaId: true },
                },
            },
        });

        if (contactos.length === 0) {
            logger.info(`[CIRCULO] Notificación omitida: sin contactos activos para ${reporte.identificador}`);
            return;
        }

        // SPEC-308: una alerta enriquecida por contacto impactado. El cooldown se
        // evalúa por usuario (ultimaNotificacionCirculoEn), no por contacto.
        const contactosANotificar = contactos.filter((contacto) => {
            const usuario = contacto.usuario;
            if (!usuario.notificacionesCirculo) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuario.id} desactivó notificaciones`);
                return false;
            }
            if (
                usuario.ultimaNotificacionCirculoEn &&
                ahora.getTime() - usuario.ultimaNotificacionCirculoEn.getTime() < cooldownMs
            ) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuario.id} en cooldown`);
                return false;
            }
            return true;
        });

        if (contactosANotificar.length === 0) return;

        // Precargar en lotes para evitar N+1: nombres de plataforma de los
        // identificadores de contacto y expedientes de los padres candidatos.
        const plataformaIds = new Set<string>();
        const usuarioIds = new Set<string>();
        for (const contacto of contactosANotificar) {
            usuarioIds.add(contacto.usuario.id);
            const identificadorContacto = contacto.identificadores.find((i) => i.valor === reporte.identificador);
            if (identificadorContacto?.plataformaId) {
                plataformaIds.add(identificadorContacto.plataformaId);
            }
        }

        const [plataformaReporte, categoria, totalReportes, plataformas, expedientes] = await Promise.all([
            obtenerNombrePlataforma(reporte.plataformaId, reporte.otraPlataforma),
            obtenerCategoriaReporte(reporte.id),
            contarReportesVisibles(reporte.identificador),
            prisma.plataforma.findMany({
                where: { id: { in: Array.from(plataformaIds) } },
                select: { id: true, nombre: true },
            }),
            prisma.expediente.findMany({
                where: {
                    padreUsuarioId: { in: Array.from(usuarioIds) },
                    identificadorReportado: reporte.identificador,
                },
                orderBy: { fechaApertura: "desc" },
                select: { padreUsuarioId: true, id: true },
            }),
        ]);

        const nombrePlataformaPorId = new Map(plataformas.map((p) => [p.id, p.nombre]));
        const expedientePorUsuario = new Map<string, string>();
        for (const e of expedientes) {
            if (!expedientePorUsuario.has(e.padreUsuarioId)) {
                expedientePorUsuario.set(e.padreUsuarioId, e.id);
            }
        }

        const usuariosActualizados = new Set<string>();

        for (const contacto of contactosANotificar) {
            const usuario = contacto.usuario;
            const identificadorContacto = contacto.identificadores.find((i) => i.valor === reporte.identificador);
            const plataforma = identificadorContacto?.plataformaId
                ? (nombrePlataformaPorId.get(identificadorContacto.plataformaId) ?? plataformaReporte)
                : plataformaReporte;
            const expedienteId = expedientePorUsuario.get(usuario.id) ?? null;

            logger.info(`[CIRCULO] Enviando alerta enriquecida a ${usuario.email} (${reporte.identificador})`);
            await enviarAlertaCirculoConfianzaEnriquecida({
                destinatario: { usuarioId: usuario.id, email: usuario.email },
                reporteId: reporte.id,
                nombreContacto: contacto.etiqueta ?? "",
                identificador: reporte.identificador,
                plataforma,
                categoria: categoria ?? "",
                totalReportes,
                expedienteId,
            });

            if (!usuariosActualizados.has(usuario.id)) {
                await prisma.usuario.update({
                    where: { id: usuario.id },
                    data: { ultimaNotificacionCirculoEn: ahora },
                });
                usuariosActualizados.add(usuario.id);
            }
        }
    } catch (error) {
        logger.error("[CIRCULO] Error enviando notificación:", error);
    }
}
