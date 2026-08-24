/**
 * SPEC-224 (002-PI-125): DTOs del panel de reglas configurables. Contrato en
 * `specs/224-panel-reglas-configurables/contracts/224-panel-reglas.md`.
 */
import type { ModoRegla } from "@prisma/client";
import type { CampoFuncional } from "./versionado";

/** Ítem de la tabla del catálogo (GET /api/admin/analisis/reglas). */
export interface ReglaListItem {
    id: string;
    clave: string;
    nombre: string;
    categoria: string;
    modo: ModoRegla;
    frecuenciaMin: number;
    prioridad: number;
    activa: boolean;
    version: number;
    recomendacionesGeneradas7d: number;
}

/** Detalle completo de una regla (GET /api/admin/analisis/reglas/[id]). */
export interface ReglaDetalle extends ReglaListItem {
    descripcion: string;
    sqlQuery: string;
    plantillaRecomendacion: string;
    accionEjecutable: string | null;
    accionParametros: unknown;
    umbralMinimo: number | null;
    creadaPorAdminId: string;
    createdAt: string;
    updatedAt: string;
    ultimaEvaluacionEn: string | null;
}

/** Resultado del test SQL (POST /api/admin/analisis/reglas/test-sql). */
export interface ResultadoTestSql {
    columnas: string[];
    filas: Array<Record<string, unknown>>;
    filasMuestra: number;
    duracionMs: number;
    limitAplicado: number;
    timeoutMs: number;
}

/** Ítem del historial de versiones (GET .../[id]/historial). */
export interface ItemHistorialRegla {
    version: number;
    creadoEn: string;
    cambiadoPor: { id: string; nombre: string };
    motivo: string;
    camposCambiados: CampoFuncional[];
    snapshot: Record<string, unknown>;
}

/** Respuesta del cambio de modo (POST .../[id]/modo). */
export interface ResultadoCambioModo {
    id: string;
    modo: ModoRegla;
    advertencia: string | null;
}
