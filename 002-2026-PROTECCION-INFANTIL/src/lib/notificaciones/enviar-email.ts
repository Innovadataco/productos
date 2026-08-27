/**
 * SPEC-296 (002-PI-197 · cierra parte de I-152): capa de envío real del motor
 * de notificaciones. Es el ÚNICO callsite legítimo de `resend.emails.send()`
 * fuera de tests. El worker `worker-notificaciones.mjs` inyecta esta función
 * como `enviarEmail` en `procesarLote()`.
 *
 * Movida desde `src/lib/email.ts` sin cambio de firma ni de comportamiento —
 * el resto de `email.ts` pasó a ser wrapper de `programar()` del motor.
 */
import { Resend } from "resend";
// SPEC-296: imports relativos porque este módulo es alcanzable desde
// scripts/worker-notificaciones.mjs (SPEC-197 · I-88 · anti-alias @/lib/).
import { requireEnv } from "../env";
import { logger } from "../logger";

const resend = new Resend(requireEnv("RESEND_API_KEY", 10));
const FROM = requireEnv("EMAIL_FROM", 5);

/**
 * SPEC-201: envío genérico del motor de notificaciones. Devuelve el id del
 * proveedor (Resend) para tracking de webhooks y deduplicación.
 */
export async function enviarEmailNotificacion(
    email: string,
    asunto: string,
    cuerpo: string
): Promise<{ id: string }> {
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: asunto,
        text: cuerpo,
    });

    if (result.error) {
        logger.error("Resend error notificación:", result.error);
        throw new Error("Error al enviar notificación por email");
    }

    const id = result.data?.id;
    if (!id) {
        throw new Error("Resend no devolvió id de notificación");
    }

    return { id };
}
