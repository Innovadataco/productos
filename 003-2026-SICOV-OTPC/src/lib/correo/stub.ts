/// Adaptador STUB de correo: registra el envío en log SIN exponer la clave temporal ni el cuerpo.
/// Se usa cuando no hay RESEND_API_KEY. Los flujos SIEMPRE completan con este adaptador.
import type { Correo, MensajeCorreo, ResultadoEnvio } from "./correo";

export function crearAdaptadorStub(): Correo {
  return {
    async enviarCorreo(mensaje: MensajeCorreo): Promise<ResultadoEnvio> {
      // Solo destinatario y asunto — NUNCA el texto (puede contener la clave temporal).
      console.log(`[correo][stub] para=${mensaje.para} asunto=${mensaje.asunto}`);
      return { ok: true, id: "stub", modo: "stub" };
    },
  };
}
