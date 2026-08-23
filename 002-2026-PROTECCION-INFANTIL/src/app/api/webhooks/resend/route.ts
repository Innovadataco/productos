import { NextResponse } from "next/server";
import { recibirWebhook, WebhookResendError } from "@/lib/notificaciones/webhook-resend";
import { logger } from "@/lib/logger";

/**
 * POST /api/webhooks/resend (SPEC-202, 002-PI-099)
 *
 * Recibe eventos de ciclo de vida de emails desde Resend.
 * - Autenticación por firma HMAC Svix usando RESEND_WEBHOOK_SECRET.
 * - Idempotente por email_id (proveedorId): re-aplicar el mismo evento no
 *   genera efectos secundarios.
 * - Actualiza sentAt, deliveredAt, openedAt, clickedAt y bouncedAt de Notificacion.
 *
 * Resend reintenta ante cualquier respuesta no-2xx, por lo que rechazamos
 * firmas/timestamps con 401/403 y problemas de payload con 400; errores
 * internos inesperados devuelven 500.
 */
export async function POST(req: Request) {
    try {
        const resultado = await recibirWebhook(req);
        logger.info(
            `[WebhookResend] Procesado: tipo=${resultado.tipo}, email_id=${resultado.emailId}, notificacion_id=${resultado.notificacionId ?? "n/a"}`
        );
        return NextResponse.json(resultado, { status: 200 });
    } catch (error) {
        if (error instanceof WebhookResendError) {
            logger.warn(`[WebhookResend] Rechazado: ${error.message} (${error.statusCode})`);
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }

        const message = error instanceof Error ? error.message : "Error interno";
        logger.error("[WebhookResend] Error procesando webhook:", message);
        return NextResponse.json({ error: "Error interno" }, { status: 500 });
    }
}
