/**
 * SPEC-202 (002-PI-099): recepción y verificación de webhooks de Resend.
 *
 * Resend firma los webhooks mediante Svix. Esta capa valida la firma HMAC,
 * deduplica/actualiza de forma idempotente por email_id (proveedorId) y
 * refleja el ciclo de vida del envío en la fila Notificacion.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";
import { NotificacionRepository } from "@/lib/dal/repositories/notificacion";
import { NotificacionContactoBloqueadoRepository } from "@/lib/dal/repositories/notificacion-contacto-bloqueado";
import { logger } from "@/lib/logger";

const WEBHOOK_TOLERANCE_SECONDS = 300;

const eventoWebhookSchema = z.object({
    type: z.enum([
        "email.sent",
        "email.delivered",
        "email.opened",
        "email.clicked",
        "email.bounced",
        "email.complained",
        "email.delivery_delayed",
    ]),
    created_at: z.string().datetime(),
    data: z.object({
        email_id: z.string(),
        created_at: z.string().datetime().optional(),
        to: z.union([z.string(), z.array(z.string())]).optional(),
        bounce: z
            .object({
                type: z.string(),
                message: z.string().optional(),
            })
            .optional(),
        complaint: z
            .object({
                type: z.string(),
            })
            .optional(),
    }),
});

export type EventoWebhookResend = z.infer<typeof eventoWebhookSchema>;

export class WebhookResendError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number
    ) {
        super(message);
        this.name = "WebhookResendError";
    }
}

function getSecretBytes(): Buffer {
    const raw = process.env.RESEND_WEBHOOK_SECRET;
    if (!raw) {
        throw new WebhookResendError("Falta RESEND_WEBHOOK_SECRET", 401);
    }

    const base64Part = raw.startsWith("whsec_") ? raw.slice("whsec_".length) : raw;
    if (!base64Part) {
        throw new WebhookResendError("Secreto de webhook inválido", 500);
    }

    try {
        return Buffer.from(base64Part, "base64");
    } catch {
        throw new WebhookResendError("Secreto de webhook inválido", 500);
    }
}

function getHeader(headers: Headers, names: string[]): string | null {
    for (const name of names) {
        const value = headers.get(name);
        if (value) return value;
    }
    return null;
}

/**
 * Verifica la firma Svix/Resend del webhook usando HMAC-SHA256.
 * Soporta prefijos `svix-*` (default) y `webhook-*` (white-label).
 *
 * @see https://resend.com/docs/webhooks/verify-webhooks-requests
 * @see https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
export function verificarFirmaWebhook(params: {
    rawBody: string;
    svixId: string;
    svixTimestamp: string;
    svixSignature: string;
}): void {
    const secretBytes = getSecretBytes();
    const signedContent = `${params.svixId}.${params.svixTimestamp}.${params.rawBody}`;

    const expected = createHmac("sha256", secretBytes).update(signedContent).digest("base64");
    const signatures = params.svixSignature.split(" ").map((s) => s.trim());

    const match = signatures.some((signatureWithVersion) => {
        const signature = signatureWithVersion.startsWith("v1,")
            ? signatureWithVersion.slice("v1,".length)
            : signatureWithVersion;
        if (signature.length !== expected.length) return false;
        try {
            return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
        } catch {
            return false;
        }
    });

    if (!match) {
        throw new WebhookResendError("Firma de webhook inválida", 401);
    }
}

function parseTimestamp(segundos: string): Date {
    const ts = parseInt(segundos, 10);
    if (Number.isNaN(ts)) {
        throw new WebhookResendError("Timestamp inválido", 401);
    }
    return new Date(ts * 1000);
}

function validarVentanaTiempo(eventTime: Date): void {
    const ahora = Date.now();
    const diff = Math.abs(ahora - eventTime.getTime()) / 1000;
    if (diff > WEBHOOK_TOLERANCE_SECONDS) {
        throw new WebhookResendError("Timestamp fuera de la ventana permitida", 401);
    }
}

function destinatarioDelEvento(data: EventoWebhookResend["data"]): string | undefined {
    if (typeof data.to === "string") return data.to;
    if (Array.isArray(data.to) && data.to.length > 0) return data.to[0];
    return undefined;
}

interface ResultadoProcesamiento {
    ok: true;
    emailId: string;
    notificacionId: string | null;
    tipo: string;
}

/**
 * Aplica un evento de Resend sobre la Notificacion correspondiente.
 * Es idempotente: re-aplicar el mismo evento produce el mismo estado final.
 */
export async function procesarEventoWebhook(
    evento: EventoWebhookResend
): Promise<ResultadoProcesamiento> {
    const repoNotif = new NotificacionRepository();
    const repoBloqueado = new NotificacionContactoBloqueadoRepository();
    const emailId = evento.data.email_id;

    const notif = await repoNotif.findByProveedorId(emailId);
    if (!notif) {
        logger.warn(
            `[WebhookResend] No se encontró notificación para email_id=${emailId}, tipo=${evento.type}`
        );
        return { ok: true, emailId, notificacionId: null, tipo: evento.type };
    }

    const timestamp = new Date(evento.created_at);

    switch (evento.type) {
        case "email.sent": {
            await repoNotif.marcarEnviada(notif.id, emailId);
            break;
        }
        case "email.delivered": {
            await repoNotif.marcarDelivered(notif.id, timestamp);
            break;
        }
        case "email.opened": {
            await repoNotif.marcarAbierta(notif.id, timestamp);
            break;
        }
        case "email.clicked": {
            await repoNotif.marcarClicada(notif.id, timestamp);
            break;
        }
        case "email.bounced": {
            const bounceType = evento.data.bounce?.type ?? "unknown";
            const message = evento.data.bounce?.message;
            const error = message ? `${bounceType} - ${message}` : `bounce: ${bounceType}`;
            await repoNotif.marcarFallidaPorBounce(notif.id, timestamp, error);
            const email = destinatarioDelEvento(evento.data) ?? notif.destinatarioEmail;
            await repoBloqueado.incrementarBounce(email, error);
            break;
        }
        case "email.complained": {
            const error = `complaint: ${evento.data.complaint?.type ?? "unknown"}`;
            await repoNotif.marcarFallidaPorComplaint(notif.id, error);
            const email = destinatarioDelEvento(evento.data) ?? notif.destinatarioEmail;
            await repoBloqueado.incrementarBounce(email, error);
            break;
        }
        case "email.delivery_delayed": {
            logger.info(
                `[WebhookResend] Entrega retrasada para notificación ${notif.id} (email_id=${emailId})`
            );
            break;
        }
    }

    return { ok: true, emailId, notificacionId: notif.id, tipo: evento.type };
}

/**
 * Flujo completo de recepción de un webhook de Resend:
 * 1. Extrae headers Svix (o white-label webhook-*).
 * 2. Verifica firma HMAC y ventana de tiempo.
 * 3. Valida y aplica el evento de forma idempotente.
 */
export async function recibirWebhook(req: Request): Promise<ResultadoProcesamiento> {
    const svixId = getHeader(req.headers, ["svix-id", "webhook-id"]);
    const svixTimestamp = getHeader(req.headers, ["svix-timestamp", "webhook-timestamp"]);
    const svixSignature = getHeader(req.headers, ["svix-signature", "webhook-signature"]);

    if (!svixId || !svixTimestamp || !svixSignature) {
        throw new WebhookResendError("Faltan headers de firma", 401);
    }

    const rawBody = await req.text();
    if (!rawBody) {
        throw new WebhookResendError("Body vacío", 400);
    }

    verificarFirmaWebhook({ rawBody, svixId, svixTimestamp, svixSignature });

    const eventTime = parseTimestamp(svixTimestamp);
    validarVentanaTiempo(eventTime);

    let parsed: unknown;
    try {
        parsed = JSON.parse(rawBody);
    } catch {
        throw new WebhookResendError("JSON inválido", 400);
    }

    const parseResult = eventoWebhookSchema.safeParse(parsed);
    if (!parseResult.success) {
        logger.warn("[WebhookResend] Payload inválido", parseResult.error.format());
        throw new WebhookResendError("Payload inválido", 400);
    }

    return procesarEventoWebhook(parseResult.data);
}
