/**
 * SPEC-224 (002-PI-125, FR-010/FR-011): helpers PUROS del versionado de
 * reglas (sin acceso a BD): construcción del snapshot del estado anterior y
 * diff legible de campos cambiados para la vista de historial. La transacción
 * (insert snapshot + update version+1) vive en el DAL
 * (`ReglasAdminRepository.actualizarConHistorial`) por la frontera Q-3.
 */
import type { ReglaRecomendacion } from "@prisma/client";

/**
 * Campos funcionales cuya modificación genera versión nueva (FR-010). `modo`
 * NO está: solo cambia por el endpoint dedicado con confirmación fuerte
 * (FR-009) y tiene su propia auditoría, sin bump de versión.
 */
export const CAMPOS_FUNCIONALES = [
    "nombre",
    "descripcion",
    "categoria",
    "sqlQuery",
    "plantillaRecomendacion",
    "accionEjecutable",
    "accionParametros",
    "prioridad",
    "umbralMinimo",
    "frecuenciaMin",
    "activa",
] as const;

export type CampoFuncional = (typeof CAMPOS_FUNCIONALES)[number];

/** Estado completo de la regla serializable a JSON (fechas como ISO). */
export function construirSnapshot(regla: ReglaRecomendacion): Record<string, unknown> {
    return {
        id: regla.id,
        clave: regla.clave,
        nombre: regla.nombre,
        descripcion: regla.descripcion,
        categoria: regla.categoria,
        sqlQuery: regla.sqlQuery,
        plantillaRecomendacion: regla.plantillaRecomendacion,
        modo: regla.modo,
        accionEjecutable: regla.accionEjecutable,
        accionParametros: regla.accionParametros,
        prioridad: regla.prioridad,
        umbralMinimo: regla.umbralMinimo,
        frecuenciaMin: regla.frecuenciaMin,
        activa: regla.activa,
        version: regla.version,
        creadaPorAdminId: regla.creadaPorAdminId,
        createdAt: regla.createdAt.toISOString(),
        updatedAt: regla.updatedAt.toISOString(),
        ultimaEvaluacionEn: regla.ultimaEvaluacionEn?.toISOString() ?? null,
    };
}

function normalizar(valor: unknown): string {
    return JSON.stringify(valor ?? null);
}

/**
 * Campos funcionales que difieren entre dos estados (snapshots o reglas).
 * Compara por valor JSON para cubrir `accionParametros` (Json?).
 */
export function diffCampos(
    antes: Record<string, unknown>,
    despues: Record<string, unknown>
): CampoFuncional[] {
    return CAMPOS_FUNCIONALES.filter(
        (campo) => normalizar(antes[campo]) !== normalizar(despues[campo])
    );
}
