import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getParametroSistema } from "@/lib/parametros";
import { logger } from "@/lib/logger";

const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.EMAIL_FROM;

/**
 * SPEC-195 (002-PI-089): notifica al denunciante autenticado cuando su reporte
 * fue confirmado como spam. Si falta RESEND_API_KEY o falla el envío, solo se
 * registra en log; nunca se bloquea el cierre del reporte.
 */
export async function notificarSpamConfirmado(reporte: {
    id: string;
    usuarioId: string | null;
    identificador: string;
}): Promise<void> {
    if (!reporte.usuarioId) return;

    const [enabledParam, templateParam] = await Promise.all([
        getParametroSistema("spam.notificacion.enabled"),
        getParametroSistema("spam.notificacion.template"),
    ]);
    if (enabledParam?.valor === "false") return;

    const template =
        templateParam?.valor ??
        "Hola,\n\nTe escribimos para informarte que tu reporte sobre {{identificador}} fue revisado y confirmado como spam. No será tenido en cuenta en las estadísticas públicas.\n\nGracias por tu participación.";

    const usuario = await prisma.usuario.findUnique({
        where: { id: reporte.usuarioId },
        select: { email: true },
    });
    if (!usuario?.email) return;

    if (!resendApiKey || !emailFrom) {
        logger.warn(
            `[EMAIL] No se envió notificación de spam confirmado (reporte=${reporte.id}): falta RESEND_API_KEY o EMAIL_FROM`
        );
        return;
    }

    try {
        const resend = new Resend(resendApiKey);
        const result = await resend.emails.send({
            from: emailFrom,
            to: usuario.email,
            subject: "Tu reporte fue revisado",
            text: template.replace(/{{identificador}}/g, reporte.identificador),
        });
        if (result.error) {
            logger.error(`[EMAIL] Error notificando spam confirmado (reporte=${reporte.id}):`, result.error);
            return;
        }
        logger.info(
            `[EMAIL] Notificación spam confirmado enviada a ${usuario.email} (reporte=${reporte.id}, resendId=${result.data?.id ?? "n/a"})`
        );
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        logger.error(`[EMAIL] Error notificando spam confirmado (reporte=${reporte.id}): ${msg}`);
    }
}
