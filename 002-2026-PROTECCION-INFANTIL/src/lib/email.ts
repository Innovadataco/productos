import { Resend } from "resend";
import { requireEnv } from "./env";
import { prisma } from "./prisma";
import { getParametroSistema } from "./parametros";
import { logger } from "@/lib/logger";

const resend = new Resend(requireEnv("RESEND_API_KEY", 10));
const FROM = requireEnv("EMAIL_FROM", 5);

export async function enviarCodigoVerificacion(
    email: string,
    codigo: string
): Promise<void> {
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Código de verificación",
        text: `Tu código de verificación es: ${codigo}\n\nVálido por 15 minutos.`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
        throw new Error("Error al enviar email de verificación");
    }
}

export async function enviarTokenRecuperacion(
    email: string,
    token: string
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const url = `${baseUrl}/recuperar/${token}`;

    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Restablece tu contraseña",
        text: `Hola,\n\nRecibimos una solicitud para restablecer tu contraseña. Haz clic en el siguiente enlace:\n\n${url}\n\nEste enlace expira en 1 hora y solo puede usarse una vez. Si no solicitaste este cambio, ignora este mensaje.`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
        throw new Error("Error al enviar email de recuperación");
    }
}

export async function enviarEmailBienvenidaOperador(
    email: string,
    tempPassword: string
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Tu cuenta de operador está lista",
        text: `Hola,\n\nSe creó tu cuenta de operador en Protección Infantil.\n\nUsuario: ${email}\nContraseña temporal: ${tempPassword}\n\nIngresa en ${baseUrl}/login y cambia tu contraseña lo antes posible desde tu perfil o usando "Olvidé mi contraseña".\n\nEsta contraseña temporal no se volverá a mostrar.`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
        throw new Error("Error al enviar email de bienvenida");
    }
}

export async function enviarEmailBienvenidaComite(
    email: string,
    tempPassword: string
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Tu cuenta de comité de validación está lista",
        text: `Hola,\n\nSe creó tu cuenta de comité de validación en Protección Infantil.\n\nUsuario: ${email}\nContraseña temporal: ${tempPassword}\n\nIngresa en ${baseUrl}/login y cambia tu contraseña lo antes posible desde tu perfil o usando "Olvidé mi contraseña".\n\nEsta contraseña temporal no se volverá a mostrar.`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
        throw new Error("Error al enviar email de bienvenida");
    }
}

export async function enviarEmailBienvenidaColegio(
    email: string,
    tempPassword: string
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Tu cuenta institucional está lista",
        text: `Hola,\n\nSe creó la cuenta institucional de tu colegio en Protección Infantil.\n\nUsuario: ${email}\nContraseña temporal: ${tempPassword}\n\nIngresa en ${baseUrl}/login y cambia tu contraseña lo antes posible.\n\nEsta contraseña temporal no se volverá a mostrar.`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
        throw new Error("Error al enviar email de bienvenida institucional");
    }
}

/**
 * 002-PI-051 (B3) — Credenciales de un padre enviadas por el admin (alta o
 * restablecimiento). Mismo patrón que el colegio: la temporal solo viaja por
 * email; si el envío falla, la ruta la muestra una sola vez al admin.
 */
export async function enviarEmailCredencialesPadre(
    email: string,
    tempPassword: string
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: "Tu cuenta en Protección Infantil",
        text: `Hola,\n\nEl equipo de la plataforma gestionó el acceso a tu cuenta en Protección Infantil.\n\nUsuario: ${email}\nContraseña temporal: ${tempPassword}\n\nIngresa en ${baseUrl}/login y cambia tu contraseña lo antes posible.\n\nEsta contraseña temporal no se volverá a mostrar.`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
        throw new Error("Error al enviar email de credenciales al padre");
    }
}

export async function enviarAlertaComitePendientes(email: string, cantidad: number): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Tienes ${cantidad} casos pendientes de revisión`,
        text: `Tienes ${cantidad} ${cantidad === 1 ? "caso" : "casos"} pendientes de revisión en el comité de validación. Ingresa para revisar:\n\n${baseUrl}/dashboard/admin/comite`,
    });

    if (result.error) {
        logger.error("Resend error alerta comité:", result.error);
        throw new Error("Error al enviar alerta de comité");
    }

    logger.info(`[EMAIL] Alerta de comité enviada a ${email} (${cantidad} casos, resendId=${result.data?.id ?? "n/a"})`);
}

/**
 * SPEC-110 — Aviso de plazo de apelaciones al comité de validación.
 * Digest diario: un solo email por miembro del comité con los casos sin resolver que
 * ya superaron apelacion.aviso_previo_dias días hábiles. Sin contenido sensible: solo
 * el número del caso y los días hábiles transcurridos.
 */
export async function enviarAvisoPlazoApelaciones(
    email: string,
    casos: { numero: string; diasHabiles: number }[]
): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const lineas = casos
        .map((c) => `- ${c.numero}: ${c.diasHabiles} días hábiles sin resolver`)
        .join("\n");
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: `${casos.length} ${casos.length === 1 ? "apelación próxima a vencer" : "apelaciones próximas a vencer"}`,
        text: `Hay ${casos.length} ${casos.length === 1 ? "apelación" : "apelaciones"} sin resolver que se acercan al plazo de respuesta (15 días hábiles, Ley 1581):\n\n${lineas}\n\nRevisa la bandeja de apelaciones:\n${baseUrl}/dashboard/admin/comite/apelaciones`,
    });

    if (result.error) {
        logger.error("Resend error aviso plazo apelaciones:", result.error);
        throw new Error("Error al enviar aviso de plazo de apelaciones");
    }

    logger.info(`[EMAIL] Aviso de plazo de apelaciones enviado a ${email} (${casos.length} casos, resendId=${result.data?.id ?? "n/a"})`);
}


async function getAdminEmails(): Promise<string[]> {
    const admins = await prisma.usuario.findMany({
        where: { rol: "ADMIN", estado: "activo" },
        select: { email: true },
    });
    return admins.map((a) => a.email);
}

async function alertasHabilitadas(clave: string): Promise<boolean> {
    const param = await getParametroSistema(clave);
    return param ? param.valor === "true" : true;
}

export async function enviarAlertaRevision(reporte: {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    estado: string;
    prioridadAlta?: boolean;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.admin.enabled"))) return;

    const admins = await getAdminEmails();
    if (admins.length === 0) return;

    const prioridadTag = reporte.prioridadAlta ? " [PRIORIDAD ALTA]" : "";
    const result = await resend.emails.send({
        from: FROM,
        to: admins,
        subject: `Reporte ${reporte.numeroSeguimiento}${prioridadTag} requiere revisión manual`,
        text: `El reporte ${reporte.numeroSeguimiento} (${reporte.identificador}) requirió revisión manual con estado ${reporte.estado}.${prioridadTag ? "\n\nMarcado como prioridad alta." : ""}\n\nVer en el panel de administración: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005"}/dashboard/admin`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
    }
}

export async function enviarAlertaScoreCritico(reporte: {
    id: string;
    identificador: string;
    plataformaId: string;
    score: number;
    nivelRiesgo: string;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.critical_score.enabled"))) return;

    const admins = await getAdminEmails();
    if (admins.length === 0) return;

    const plataforma = await prisma.plataforma.findUnique({
        where: { id: reporte.plataformaId },
        select: { nombre: true },
    });

    const result = await resend.emails.send({
        from: FROM,
        to: admins,
        subject: `Score crítico: ${reporte.identificador}`,
        text: `El identificador ${reporte.identificador} en ${plataforma?.nombre ?? reporte.plataformaId} alcanzó un score de ${reporte.score} (${reporte.nivelRiesgo}).\n\nVer en el panel de administración: ${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005"}/dashboard/admin`,
    });

    if (result.error) {
        logger.error("Resend error:", result.error);
    }
}

export async function enviarAlertaCirculoConfianza(email: string, cantidad: number): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const novedadTexto = cantidad === 1 ? "1 novedad" : `${cantidad} novedades`;
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Tienes ${novedadTexto} en tu Círculo de Confianza`,
        text: `Tienes ${novedadTexto} en tu Círculo de Confianza. Ingresa para revisar:\n\n${baseUrl}/dashboard/circulo-confianza`,
    });

    if (result.error) {
        logger.error("Resend error alerta círculo:", result.error);
        throw new Error("Error al enviar alerta de Círculo de Confianza");
    }

    logger.info(`[EMAIL] Alerta Círculo de Confianza enviada a ${email} (${novedadTexto}, resendId=${result.data?.id ?? "n/a"})`);
}

const COOLDOWN_ALERTA_MS = 24 * 60 * 60 * 1000;

export async function enviarAlertaColegio(email: string, cantidad: number): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const novedadTexto = cantidad === 1 ? "1 novedad" : `${cantidad} novedades`;
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: `Tiene ${novedadTexto} para revisar en su panel de colegio`,
        text: `Tiene ${novedadTexto} para revisar en su panel de colegio. Ingrese y valide.\n\n${baseUrl}/dashboard/colegio/alertas`,
    });

    if (result.error) {
        logger.error("Resend error alerta colegio:", result.error);
        throw new Error("Error al enviar alerta de colegio");
    }

    logger.info(`[EMAIL] Alerta de colegio enviada a ${email} (${novedadTexto}, resendId=${result.data?.id ?? "n/a"})`);
}

export async function enviarAlertasSuscriptores(payload: {
    identificador: string;
    plataformaId: string;
    totalReportes: number;
}): Promise<void> {
    if (!(await alertasHabilitadas("alerts.subscriptions.enabled"))) return;

    const ahora = new Date();
    const ventana = new Date(ahora.getTime() - COOLDOWN_ALERTA_MS);

    const suscripciones = await prisma.alertaSuscripcion.findMany({
        where: {
            identificador: payload.identificador,
            plataformaId: payload.plataformaId,
            activa: true,
            OR: [{ ultimoEmailEn: { lt: ventana } }, { ultimoEmailEn: null }],
        },
        include: { usuario: { select: { email: true } }, plataforma: { select: { nombre: true } } },
    });

    if (suscripciones.length === 0) return;

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5005";
    const consultaUrl = `${baseUrl}/?consulta=${encodeURIComponent(payload.identificador)}`;

    const enviadosIds: string[] = [];
    for (const suscripcion of suscripciones) {
        const email = suscripcion.usuario.email;
        try {
            const result = await resend.emails.send({
                from: FROM,
                to: email,
                subject: `Nuevo reporte para ${payload.identificador}`,
                text: `Hola,\n\nSe registró un nuevo reporte para el identificador "${payload.identificador}" en ${suscripcion.plataforma.nombre}.\n\nTotal de reportes: ${payload.totalReportes}\n\nConsulta el score y los detalles aquí:\n${consultaUrl}\n\nRecibirás como máximo un email cada 24 horas por este identificador.`,
            });

            if (result.error) {
                logger.error(`Resend error alerta ${suscripcion.id}:`, result.error);
            } else {
                enviadosIds.push(suscripcion.id);
            }
        } catch (err) {
            logger.error(`Error enviando alerta ${suscripcion.id}:`, err);
        }
    }

    if (enviadosIds.length > 0) {
        await prisma.alertaSuscripcion.updateMany({
            where: { id: { in: enviadosIds } },
            data: { ultimoEmailEn: ahora },
        });
    }
}
