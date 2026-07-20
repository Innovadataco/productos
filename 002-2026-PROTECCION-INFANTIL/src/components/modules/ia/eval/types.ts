export interface Caso {
    id: string;
    texto: string;
    categoriaEsperada: string;
    secundariaEsperada: string | null;
    ruido: boolean;
    fuente: string;
    activo: boolean;
    fixtureVersion: number;
    creadoEn: string;
    creadoPor: { email: string | null; nombre: string | null } | null;
}

export interface Experimento {
    id: string;
    nombre: string | null;
    notas: string | null;
    tipo: string;
    fixtureVersion: number;
    estado: string;
    iniciadoEn: string;
    finalizadoEn: string | null;
    configSnapshot: Record<string, unknown> | null;
    progresoCasos: number;
    progresoTotal: number;
    resultadoJson: Record<string, unknown> | null;
    error: string | null;
    creadoPor: { email: string | null; nombre: string | null } | null;
}

export interface ExperimentoDetalle {
    experimento: Experimento;
    metrics: RunMetrics | null;
    perCategory: Record<string, PerCategoryMetrics> | null;
    operational: OperationalMetrics | null;
    baseline: { id: string; nombre: string | null; metrics: RunMetrics } | null;
    baselineMissing: boolean;
}

export interface RunMetrics {
    accuracy: number;
    precisionAutoClasificados: number;
    errorSilencioso: number;
    revisionManualRate: number;
    latencyP50Ms: number;
    latencyP95Ms: number;
    posibleAgresorParRate: number;
    recallOTRO: number;
}

export interface PerCategoryMetrics {
    precision: number;
    recall: number;
    f1: number;
    support: number;
}

export interface OperationalMetrics {
    duracionTotalMs: number;
    casosPorMinuto: number;
    tasaFallbacks: number;
    activacionesGuardas: number;
    doxingVerdaderas: number;
    keywordsActivadas: number;
    prioridadAltaTotal: number;
}

export interface OllamaModel {
    name: string;
    tag: string;
    size: number;
    esEmbedding: boolean;
}

export interface CompareResult {
    comparable: boolean;
    fixtureVersion: number;
    experimentos: Array<{
        id: string;
        nombre: string | null;
        metrics: RunMetrics | null;
    }>;
    frontier: Array<unknown>;
    error?: { message: string };
}

export const CATEGORIAS = [
    "CONTACTO_INSISTENTE",
    "SOLICITUD_MATERIAL",
    "OFRECIMIENTO_REGALOS",
    "SUPLANTACION_IDENTIDAD",
    "SOLICITUD_ENCUENTRO",
    "COMPARTIMIENTO_SEXUAL",
    "OTRO",
    "EXTORSION",
    "CONTENIDO_GENERADO_IA",
    "DIFUSION_NO_CONSENTIDA",
    "DOXING",
];

export const FUENTES = ["SEMILLA", "MANUAL_ADMIN", "PRODUCCION_ANONIMIZADO"];
