import { extraerMensajeError } from "@/lib/normalizar";

/// D-021 (CEO, HANDOFF §11.1): la vía web INTENTA reportar de una vez; si la Super falla, el
/// registro CAE A LA COLA (ya quedó persistido como `pendiente`) y el worker lo reintenta.
/// Helper compartido por las tres colas para no divergir en tres implementaciones.
/// Devuelve true si el envío inmediato tuvo éxito; false si cayó a cola (nunca lanza).
export async function intentarEnvioInmediato(enviar: () => Promise<void>): Promise<boolean> {
  try {
    await enviar();
    return true;
  } catch (err: unknown) {
    // El primer intento fallido NO consume reintentos: el ciclo de la cola es del worker.
    console.log(`[envio-inmediato] caída a cola: ${extraerMensajeError(err)}`);
    return false;
  }
}
