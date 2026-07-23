/// Adaptador Resend (D-048, US3): envío por API HTTP de Resend vía `fetch` (cero deps, no SMTP).
/// La key NUNCA se loguea ni se expone; un fallo devuelve ResultadoEnvio.ok=false sin lanzar
/// (el alta no depende del correo). El remitente sale de CORREO_REMITENTE.
import type { Correo, MensajeCorreo, ResultadoEnvio } from "./correo";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REMITENTE_POR_DEFECTO = "SICOV-OTPC <onboarding@resend.dev>";

export function crearAdaptadorResend(apiKey: string, remitente?: string): Correo {
  const from = remitente && remitente.length > 0 ? remitente : REMITENTE_POR_DEFECTO;
  return {
    async enviarCorreo(mensaje: MensajeCorreo): Promise<ResultadoEnvio> {
      try {
        const res = await fetch(RESEND_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            from,
            to: [mensaje.para],
            subject: mensaje.asunto,
            text: mensaje.texto,
          }),
        });

        if (!res.ok) {
          // No incluimos el cuerpo (podría reflejar el payload); solo el status.
          return { ok: false, error: `Resend respondió ${res.status}`, modo: "resend" };
        }
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        return { ok: true, id: data.id, modo: "resend" };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Error desconocido";
        return { ok: false, error: message, modo: "resend" };
      }
    },
  };
}
