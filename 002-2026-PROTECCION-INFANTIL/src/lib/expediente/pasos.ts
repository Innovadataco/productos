import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Claves de etapa del parámetro admin.expediente.etapas (capa 2).
export type EtapaProcesamiento = "guardas" | "deduplicacion" | "contexto_rag" | "decision";

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
        await prisma.pasoProcesamiento.create({
            data: {
                reporteId,
                etapa,
                // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
                ...(opciones.veredicto !== undefined ? { veredicto: opciones.veredicto } : {}),
                ...(opciones.detalle !== undefined ? { detalle: opciones.detalle as Prisma.InputJsonValue } : {}),
                ...(opciones.latenciaMs !== undefined ? { latenciaMs: opciones.latenciaMs } : {}),
            },
        });
    } catch (err) {
        console.error("[Expediente] Error registrando paso de procesamiento", {
            reporteId,
            etapa,
            error: err instanceof Error ? err.message : String(err),
        });
    }
}
