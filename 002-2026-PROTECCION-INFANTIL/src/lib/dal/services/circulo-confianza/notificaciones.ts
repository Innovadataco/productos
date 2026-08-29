/**
 * SPEC-135 (E-2): notificación ciega del círculo cuando un reporte visible toca un
 * identificador del círculo de un usuario. Movimiento mecánico desde el god-module
 * (F1); la revisión N+1 (FR-004) se aplica en la F2 de SPEC-135.
 */
import { prisma } from "@/lib/prisma";
import { getParametroSistemaValor } from "@/lib/parametros";
import { enviarAlertaCirculoConfianza } from "@/lib/email";
import type { EstadoReporte } from "@prisma/client";
import { logger } from "@/lib/logger";
import { ESTADOS_VISIBLES } from "./tipos";

/**
 * Evalúa si un reporte debe notificar a los usuarios que tienen contactos de confianza
 * asociados al mismo identificador. Respeta la preferencia de notificaciones del usuario,
 * el flag global de notificaciones y un periodo de cooldown entre alertas. Envía un email
 * de alerta ciega con el conteo de novedades y actualiza la marca temporal de la última notificación.
 * Cualquier error se captura y se loguea sin interrumpir el flujo.
 *
 * @param reporteId - UUID del reporte que puede generar notificaciones.
 */
export async function notificarCambioCirculoSiCorresponde(reporteId: string) {
    try {
        const reporte = await prisma.reporte.findUnique({
            where: { id: reporteId },
            select: {
                identificador: true,
                estado: true,
                eliminado: true,
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
                    select: { valor: true },
                },
            },
        });

        if (contactos.length === 0) {
            logger.info(`[CIRCULO] Notificación omitida: sin contactos activos para ${reporte.identificador}`);
            return;
        }

        // Agrupar contactos por usuario
        const contactosPorUsuario = new Map<
            string,
            { email: string; notificacionesCirculo: boolean; ultimaNotificacionCirculoEn: Date | null; valores: Set<string> }
        >();
        for (const contacto of contactos) {
            const usuario = contacto.usuario;
            const existente = contactosPorUsuario.get(usuario.id);
            const valores = new Set(contacto.identificadores.map((i) => i.valor));
            if (existente) {
                for (const v of valores) existente.valores.add(v);
            } else {
                contactosPorUsuario.set(usuario.id, {
                    email: usuario.email,
                    notificacionesCirculo: usuario.notificacionesCirculo,
                    ultimaNotificacionCirculoEn: usuario.ultimaNotificacionCirculoEn,
                    valores,
                });
            }
        }

        // SPEC-135 (E-2, FR-004): el conteo de novedades por usuario era una query por
        // usuario (N+1 real). Ahora UNA query para todos los valores de los usuarios
        // candidatos en la ventana mínima común (ahora - cooldown; cada ventanaInicio
        // individual es >= esa cota), y el distinct por usuario se calcula en memoria.
        // Mismo resultado por construcción: la ventana y los valores de cada usuario
        // son un subconjunto de la query global. El loop restante NO es un N+1 de
        // lectura: son envíos de email y un update de timestamp por usuario notificado.
        const valoresCandidatos = new Set<string>();
        for (const datos of contactosPorUsuario.values()) {
            if (!datos.notificacionesCirculo) continue;
            for (const v of datos.valores) valoresCandidatos.add(v);
        }
        const reportesEnVentana =
            valoresCandidatos.size > 0
                ? await prisma.reporte.findMany({
                    where: {
                        identificador: { in: Array.from(valoresCandidatos) },
                        eliminado: false,
                        estado: { in: ESTADOS_VISIBLES },
                        creadoEn: { gte: new Date(ahora.getTime() - cooldownMs) },
                    },
                    select: { identificador: true, creadoEn: true },
                })
                : [];

        for (const [usuarioId, datos] of contactosPorUsuario.entries()) {
            if (!datos.notificacionesCirculo) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuarioId} desactivó notificaciones`);
                continue;
            }

            const ventanaInicio = datos.ultimaNotificacionCirculoEn
                ? new Date(Math.max(datos.ultimaNotificacionCirculoEn.getTime(), ahora.getTime() - cooldownMs))
                : new Date(ahora.getTime() - cooldownMs);

            // Distinct de identificadores con reportes visibles en la ventana del usuario
            const identificadoresNuevos = new Set<string>();
            for (const r of reportesEnVentana) {
                if (datos.valores.has(r.identificador) && r.creadoEn >= ventanaInicio) {
                    identificadoresNuevos.add(r.identificador);
                }
            }

            const novedades = identificadoresNuevos.size;
            if (novedades === 0) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuarioId} sin novedades en la ventana`);
                continue;
            }

            if (
                datos.ultimaNotificacionCirculoEn &&
                ahora.getTime() - datos.ultimaNotificacionCirculoEn.getTime() < cooldownMs
            ) {
                logger.info(`[CIRCULO] Notificación omitida: usuario ${usuarioId} en cooldown`);
                continue;
            }

            logger.info(`[CIRCULO] Enviando alerta ciega a ${datos.email} (${novedades} novedades)`);
            await enviarAlertaCirculoConfianza(datos.email, novedades);
            await prisma.usuario.update({
                where: { id: usuarioId },
                data: { ultimaNotificacionCirculoEn: ahora },
            });
        }
    } catch (error) {
        logger.error("[CIRCULO] Error enviando notificación:", error);
    }
}
