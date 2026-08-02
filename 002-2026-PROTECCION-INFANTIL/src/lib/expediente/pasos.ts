import { Prisma } from "@prisma/client";
import { PasoProcesamientoRepository } from "@/lib/dal/repositories/paso-procesamiento";

// Claves de etapa del parámetro admin.expediente.etapas (capa 2).
// "match_detectado" (SPEC-139, F5): traza del evento de match (solo metadatos).
export type EtapaProcesamiento = "guardas" | "deduplicacion" | "contexto_rag" | "decision" | "match_detectado";

/**
 * Registra un paso del pipeline de procesamiento (spec 096-US3).
 * Best-effort: NUNCA propaga errores; si la escritura falla solo logea,
 * porque el expediente no puede romper el procesamiento del reporte.
 */
export async function registrarPaso(
    reporteId: string,
    etapa: EtapaProcesamiento,
    opciones: { veredicto?: string; detalle?: Record<string, unknown>; latenciaMs?: number } = {}
): Promise<void> {
    try {
        // E-8: la escritura vive en el repo; la política best-effort no cambia.
        await new PasoProcesamientoRepository().crear({
            reporteId,
            etapa,
            // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
            ...(opciones.veredicto !== undefined ? { veredicto: opciones.veredicto } : {}),
            ...(opciones.detalle !== undefined ? { detalle: opciones.detalle as Prisma.InputJsonValue } : {}),
            ...(opciones.latenciaMs !== undefined ? { latenciaMs: opciones.latenciaMs } : {}),
        });
    } catch (err) {
        console.error("[Expediente] Error registrando paso de procesamiento", {
            reporteId,
            etapa,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
