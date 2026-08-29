/**
 * SPEC-302 (002-PI-208 · R-022 §1.3 punto a): métrica de notificaciones
 * ENCOLADAS vencidas — señal temprana de un worker atascado (patrón I-147).
 * Frontera DAL (Q-3): el acceso a Prisma vive en NotificacionRepository.
 * Import relativo (no `@/lib/`): este módulo es alcanzable desde
 * scripts/monitor-probes.mjs vía probes.ts (SPEC-197 · I-88 · anti-alias).
 */
import { NotificacionRepository } from "../dal/repositories/notificacion";

export async function contarPendientesVencidas(
    umbralMinutos = 15,
    repo: NotificacionRepository = new NotificacionRepository()
): Promise<number> {
    const umbral = new Date(Date.now() - umbralMinutos * 60_000);
    return repo.contarEncoladasVencidas(umbral);
}
