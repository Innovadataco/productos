import { decidirGuardasSeguridad } from "@/lib/ai/guardas-decision";
import { registrarPaso } from "@/lib/expediente/pasos";
import type { EstadoReporte } from "@prisma/client";
import type { ClasificacionResult } from "./clasificacion";

/**
 * Guardas de seguridad del pipeline de procesamiento (spec 026, spec 096, F7).
 *
 * Wrapper PRODUCTIVO de la fuente única de la decisión
 * (`decidirGuardasSeguridad` en `@/lib/ai/guardas-decision`): la decisión
 * (orden de ramas, cortocircuitos, prioridades) vive SOLO allí; este helper
 * añade el side-effect `registrarPaso` (trazabilidad de expediente, que solo
 * tiene sentido con un reporte persistido). E-4: dejó de ser una réplica.
 */
export function aplicarGuardasSeguridad({
    reporteId,
    texto,
    clasificacion,
    estadoInicial,
    esRafaga,
    umbralSpam,
}: {
    reporteId: string;
    texto: string;
    clasificacion: ClasificacionResult;
    estadoInicial: EstadoReporte;
    esRafaga: boolean;
    umbralSpam: number;
}): {
    estadoFinal: EstadoReporte;
    prioridadAlta: boolean;
    keywordsDetectadas: string[];
} {
    const decision = decidirGuardasSeguridad({ texto, clasificacion, estadoInicial, esRafaga, umbralSpam });

    // Spec 096-US3: razón explícita de la regla de decisión (best-effort).
    void registrarPaso(reporteId, "decision", {
        veredicto: decision.estadoFinal,
        detalle: {
            estadoInicial,
            reglas: decision.reglasAplicadas,
            prioridadAlta: decision.prioridadAlta,
            keywordsDetectadas: decision.keywordsDetectadas,
            categoria: clasificacion.categoria,
            confianza: clasificacion.confianza,
        },
    });

    return {
        estadoFinal: decision.estadoFinal,
        prioridadAlta: decision.prioridadAlta,
        keywordsDetectadas: decision.keywordsDetectadas,
    };
}
