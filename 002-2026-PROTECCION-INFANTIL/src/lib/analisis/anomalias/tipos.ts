/**
 * SPEC-225 (002-PI-126): tipos del detector de anomalías dinero-vs-valor.
 *
 * H-1 (tasks.md): el modelo `Anomalia` de SPEC-220 usa `String` con valores
 * cerrados en vez de enums Prisma; aquí se expresan como uniones de literales
 * para conservar el tipado estricto sin migración destructiva.
 */
import type { AnomaliaRepository } from "@/lib/dal/repositories/anomalia-repository";
import type { RangoSemana } from "./ventanas";

export const TIPOS_ANOMALIA = [
    "PAGO_ATRASADO_CLIENTE_HISTORICAMENTE_PUNTUAL",
    "CRECIMIENTO_ANOMALO_CIUDAD",
    "USO_CAIDO_ABRUPTO",
    "CANCELACION_COLEGIO_GRANDE",
    "CAIDA_RECAUDO_CIUDAD",
    "CANCELACIONES_MASIVAS_24H",
] as const;
export type TipoAnomalia = (typeof TIPOS_ANOMALIA)[number];

export const SEVERIDADES_ANOMALIA = ["BAJA", "MEDIA", "ALTA"] as const;
export type SeveridadAnomalia = (typeof SEVERIDADES_ANOMALIA)[number];

/** Umbrales frescos leídos de `ParametroSistema` en cada tick (FR-004). */
export interface ParametrosAnomalias {
    tickMin: number;
    moraDiasUmbralMedia: number;
    moraDiasUmbralAlta: number;
    crecimientoPctUmbral: number;
    usoCaidoPctUmbral: number;
    caidaRecaudoPctUmbral: number;
    cancelaciones24hUmbral: number;
    colegioGrandeMinReportes: number;
    baseMinimaComparacion: number;
    emailInmediatoHabilitado: boolean;
}

/** Ventanas temporales del tick, ya calculadas en America/Bogota. */
export interface VentanasDeteccion {
    semanaActual: RangoSemana;
    semanaAnterior: RangoSemana;
    ultimas24h: { desde: Date; hasta: Date };
}

/** Contexto que recibe cada regla: umbrales + ventanas + acceso a datos (DAL). */
export interface ContextoDeteccion {
    ahora: Date;
    parametros: ParametrosAnomalias;
    ventanas: VentanasDeteccion;
    repo: AnomaliaRepository;
}

/**
 * Hallazgo de una regla antes de deduplicar/persistir. `datosContexto` solo
 * admite agregados (conteos, porcentajes, umbrales, ventanas, ids internos):
 * PROHIBIDO texto de reportes, datos de menores o PII de titulares (FR-008).
 */
export interface CandidatoAnomalia {
    tipo: TipoAnomalia;
    sujetoTipo: string | null;
    sujetoId: string | null;
    severidad: SeveridadAnomalia;
    descripcion: string;
    datosContexto: Record<string, unknown>;
}

/** Resumen del tick para los logs del worker. */
export interface ResumenTick {
    detectadas: number;
    altas: number;
    notificadas: number;
    /** Mensajes de error por regla (un fallo no detiene las demás). */
    errores: string[];
}
