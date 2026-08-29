/**
 * SPEC-225 (US2, FR-009/FR-010): alerta inmediata al CEO para anomalías de
 * severidad ALTA vía Motor Notif (SPEC-201..204). Cero cambios al motor: solo
 * se publica el evento `analisis.anomalia.detectada` con un destinatario por
 * usuario ADMIN activo; las reglas sembradas (EMAIL obligatoria + IN_APP)
 * deciden canales, plantillas y quiet hours.
 *
 * Fail-open HACIA NOTIFICACIONES, nunca hacia la detección: un error aquí se
 * loguea y devuelve 0; la anomalía ya quedó persistida por el detector.
 */
import type { Anomalia } from "@prisma/client";
import { programar } from "@/lib/notificaciones";
import { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";

export const EVENTO_ANOMALIA_DETECTADA = "analisis.anomalia.detectada";

/**
 * Publica el evento para una anomalía ALTA recién persistida. Devuelve el
 * número de notificaciones programadas (0 si no hay ADMINs activos, si el
 * motor no tiene reglas activas o si falla — siempre fail-open).
 */
export async function alertarAnomaliaAlta(
    anomalia: Anomalia,
    repo: AnomaliaRepository = new AnomaliaRepository()
): Promise<number> {
    try {
        const admins = await repo.listarAdminsActivos();
        if (admins.length === 0) {
            console.warn("[Anomalias] Sin destinatarios ADMIN activos");
            return 0;
        }
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
        const variables: Record<string, unknown> = {
            tipoAnomalia: anomalia.tipo,
            severidad: anomalia.severidad,
            descripcion: anomalia.descripcion,
            fechaDeteccion: anomalia.detectadaEn.toISOString(),
            // El tab "Dinero vs Valor" lo entrega SPEC-222; la página existe ya.
            urlAnomalia: `${appUrl}/dashboard/admin/estadisticas`,
        };
        const resultado = await programar({
            evento: EVENTO_ANOMALIA_DETECTADA,
            sujetoTipo: "Anomalia",
            sujetoId: anomalia.id,
            destinatarios: admins.map((a) => ({ usuarioId: a.id, variables })),
        });
        return resultado.programadas;
    } catch (err) {
        console.error(
            `[Anomalias] Error programando alerta de anomalía ${anomalia.id}:`,
            err instanceof Error ? err.message : err
        );
        return 0;
    }
}
