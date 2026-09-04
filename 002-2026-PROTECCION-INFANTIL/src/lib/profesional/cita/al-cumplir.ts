/**
 * SPEC-429 / SPEC-427 · Contrato de unión entre los dos PRs del ciclo del
 * brief §7 L6 + L6-bis. Vive en `productos/002-.../src/lib/profesional/cita/`
 * como punto único donde 427 (Dev 02) llama y 429 (Dev 01) rellena.
 *
 * Dev 02 la invoca en `cierre.service.ts` (`cerrarConCodigoDeCita`), después
 * del audit `CITA_PROFESIONAL_CUMPLIDA`, **fuera de la transacción y con
 * try/catch + logger.error**: que una encuesta no se active no deshace una
 * sesión que ocurrió, y tampoco muere muda.
 *
 * Dev 01 (SPEC-429): activa la encuesta para padre y profesional levantando
 * `Usuario.encuestaPendiente = true` en los dos. La guardia del middleware
 * los va a redirigir a `/encuesta` en la próxima navegación.
 *
 * Q-3: usamos `EncuestaCitaRepository` para no importar `@/lib/prisma`.
 */
import { logger } from "@/lib/logger";
import { EncuestaCitaRepository } from "@/lib/dal/repositories/encuesta-cita";

export async function alCumplirCita(solicitudId: string): Promise<void> {
    try {
        const repo = new EncuestaCitaRepository();
        const partes = await repo.resolverPartes(solicitudId);
        if (!partes) {
            // La llamada llega desde `cerrarConCodigoDeCita` justo después de
            // escribir `CUMPLIDA`, así que la solicitud existe siempre. Un
            // hallazgo de `null` acá es un bug ruidoso, no un no-op silencioso.
            logger.error("[SPEC-429 alCumplirCita] solicitud no encontrada", { solicitudId });
            return;
        }
        // Sube la guardia para los dos lados. Idempotente: repetir la llamada
        // no cambia el estado si ya está en true. El POST /api/encuesta la
        // baja cuando al usuario no le queda ninguna otra pendiente.
        await repo.marcarEncuestaPendiente(
            [partes.padreUsuarioId, partes.profesional.usuarioId],
            true,
        );
    } catch (err) {
        // Contrato con 427: no relanzamos — la sesión ocurrió, la encuesta
        // se activa por reintento (el próximo GET de la próxima cita CUMPLIDA
        // recalcula), pero no queremos deshacer el cierre.
        logger.error("[SPEC-429 alCumplirCita] fallo activando encuestas", { solicitudId, err });
    }
}
