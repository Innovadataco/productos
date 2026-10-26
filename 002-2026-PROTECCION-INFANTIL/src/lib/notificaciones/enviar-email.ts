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
import { EmailProveedorError, resumirErrorProveedor } from "./motivo-error";
import { renderizarEmail } from "./render-html";

const resend = new Resend(requireEnv("RESEND_API_KEY", 10));
const FROM = requireEnv("EMAIL_FROM", 5);

/**
 * SPEC-201: envío genérico del motor de notificaciones. Devuelve el id del
 * proveedor (Resend) para tracking de webhooks y deduplicación.
 *
 * SPEC-401 (I-283): en vez del `throw new Error("Error al enviar notificación
 * por email")` genérico —el mismo texto para las 10.498 fallas que teníamos en
 * prod, sin forma de distinguir cuota de dominio inválido—, ahora se lanza
 * `EmailProveedorError` cuyo `.message` es `[<name>][<statusCode>] <mensaje
 * sanitizado>`. `procesar-lote.ts` lo persiste tal cual en
 * `Notificacion.ultimoError` (sigue leyendo `err.message`, cero cambios en el
 * catch). El log completo con el objeto crudo del proveedor se mantiene para
 * dev; a BD solo va la versión sin PII.
 *
 * SPEC-909: `cuerpo` llega como Markdown (ya con las variables `{{..}}` sustituidas
 * por `renderizarPlantilla`). Antes se enviaba SOLO `text: cuerpo` → `**negrita**` y
 * los enlaces salían literales. Ahora se envía `html:` (Markdown renderado, saneado,
 * con layout institucional y enlace → botón) + `text:` (respaldo sin sintaxis). Es el
 * ÚNICO punto de envío, así que la corrección es sistémica: todos los eventos y el
 * preview del admin salen con formato por la misma puerta.
 */
export async function enviarEmailNotificacion(
    email: string,
    asunto: string,
    cuerpo: string
): Promise<{ id: string }> {
    const { html, texto } = renderizarEmail(cuerpo, { asunto });
    const result = await resend.emails.send({
        from: FROM,
        to: email,
        subject: asunto,
        html,
        text: texto,
    });

    if (result.error) {
        logger.error("Resend error notificación:", result.error);
        throw new EmailProveedorError(resumirErrorProveedor(result.error));
    }

    const id = result.data?.id;
    if (!id) {
        throw new Error("Resend no devolvió id de notificación");
    }

    return { id };
}
