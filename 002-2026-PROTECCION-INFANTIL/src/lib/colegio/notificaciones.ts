/**
 * SPEC-169 (Fase G): disparadores de notificaciones in-app del colegio.
 * Las notificaciones son independientes del pipeline de email (SPEC-149): fallan
 * en silencio y nunca bloquean el flujo principal.
 *
 * FR-009: los mensajes son genéricos y NUNCA incluyen el texto del reporte,
 * nombres del denunciante ni datos sensibles.
 */
import { logger } from "@/lib/logger";
import { UsuarioRepository } from "@/lib/dal/repositories/usuario";
import {
    NotificacionInAppRepository,
    type TipoNotificacionInApp,
} from "@/lib/dal/repositories/notificacion-in-app";

const PLANTILLAS: Record<
    TipoNotificacionInApp,
    (entidadTipo: string) => { titulo: string; mensaje: string }
> = {
    ALERTA_NUEVA: () => ({
        titulo: "Nueva alerta en tu colegio",
        mensaje: "Se registró una alerta que requiere revisión. Entra para ver el detalle.",
    }),
    ALERTA_GESTIONADA: () => ({
        titulo: "Alerta gestionada",
        mensaje: "Una alerta fue marcada como gestionada. Puedes revisar el seguimiento.",
    }),
    ALERTA_ESCALADA: () => ({
        titulo: "Alerta escalada",
        mensaje: "Una alerta fue escalada. Revisa el caso para conocer los siguientes pasos.",
    }),
    SISTEMA: () => ({
        titulo: "Aviso del sistema",
        mensaje: "Hay una novedad importante sobre tu servicio. Entra para más detalles.",
    }),
};

async function resolverAdminDestino(colegioId: string): Promise<{ id: string; email: string } | null> {
    const admin = await new UsuarioRepository().findAdminColegioParaNotificacion(colegioId);
    return admin ? { id: admin.id, email: admin.email } : null;
}

async function crearNotificacion(
    colegioId: string,
    tipo: TipoNotificacionInApp,
    entidadId?: string
) {
    const destinatario = await resolverAdminDestino(colegioId);
    if (!destinatario) {
        logger.info(`[NOTIFICACIONES] Sin SCHOOL_ADMIN activo para colegio ${colegioId}; se omite ${tipo}`);
        return null;
    }

    const plantilla = PLANTILLAS[tipo]("ALERTA_COLEGIO");
    return new NotificacionInAppRepository().crear({
        colegioId,
        usuarioId: destinatario.id,
        tipo,
        titulo: plantilla.titulo,
        mensaje: plantilla.mensaje,
        ...(entidadId ? { entidadId } : {}),
    });
}

/**
 * Crea una notificación in-app a partir de una alerta del colegio.
 * Falla en silencio si no hay destinatario.
 */
export async function crearNotificacionDesdeAlerta(
    colegioId: string,
    alertaId: string,
    tipo: TipoNotificacionInApp
) {
    try {
        return await crearNotificacion(colegioId, tipo, alertaId);
    } catch (error) {
        logger.error(`[NOTIFICACIONES] Error creando ${tipo} para alerta ${alertaId}:`, error);
        return null;
    }
}

/**
 * Crea una notificación de sistema para el colegio (ej. vencimiento próximo).
 */
export async function crearNotificacionSistema(colegioId: string, titulo: string, mensaje: string) {
    const destinatario = await resolverAdminDestino(colegioId);
    if (!destinatario) return null;
    try {
        return await new NotificacionInAppRepository().crear({
            colegioId,
            usuarioId: destinatario.id,
            tipo: "SISTEMA",
            titulo,
            mensaje,
        });
    } catch (error) {
        logger.error(`[NOTIFICACIONES] Error creando notificación de sistema para colegio ${colegioId}:`, error);
        return null;
    }
}
