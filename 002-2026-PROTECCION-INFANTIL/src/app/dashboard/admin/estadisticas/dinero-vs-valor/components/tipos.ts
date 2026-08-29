/**
 * SPEC-222 (002-PI-123): tipos de las respuestas de `/api/admin/analisis/**`
 * consumidas por el panel (contratos/222-panel-analisis.md).
 */

export type Semaforo = "pino" | "ambar" | "rubi";
export type Cuadrante = "estables" | "riesgo" | "oportunidad" | "atencion";
export type Granularidad = "pais" | "ciudad" | "colegio" | "padre" | "plan" | "cohorte" | "canal";

export interface TopDecision {
    id: string;
    titulo: string;
    descripcion: string;
    categoria: string;
    prioridad: number;
    generadaEn: string;
    expiraEn: string;
    sujetoTipo: string | null;
    sujetoId: string | null;
    accionSugerida: string | null;
    contacto: { telefono: string | null; email: string | null } | null;
}

export interface KpiValor {
    valor: number;
    deltaPct: number | null;
}

export interface KpisRespuesta {
    kpis: {
        mau: KpiValor;
        mrrUSD: KpiValor;
        churnRatePct: KpiValor;
        ltvUSD: KpiValor;
        renovacionesPct: KpiValor;
        conversionFreemiumPct: KpiValor;
        referidosExitososPct: KpiValor;
    };
    periodo: { desde: string; hasta: string; zona: string };
}

export interface PuntoDispersion {
    suscripcionId: string;
    cliente: string;
    tipoTitular: "COLEGIO" | "PADRE";
    montoUSD: number;
    scoreTotal: number;
    cuadrante: Cuadrante;
}

export interface DispersionRespuesta {
    puntos: PuntoDispersion[];
    cortes: { montoUSD: number; score: number; fuente: "mediana" | "parametro" };
    truncado: boolean;
    totalSuscripciones: number;
    sinScore: number;
}

export interface FilaGranularidad {
    clave: string;
    etiqueta: string;
    suscripciones: number;
    recaudoUSD: number;
    scorePromedio: number | null;
    variacionRecaudoPct: number | null;
    semaforo: Semaforo;
    drill: { granularidad: Granularidad; params: Record<string, string> } | null;
    suscripcionId: string | null;
    retenidosPct?: number;
    renovacionPct?: number;
}

export interface Paginacion {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface DineroVsValorRespuesta {
    items: FilaGranularidad[];
    pagination: Paginacion;
    totales: { suscripciones: number; recaudoUSD: number; scorePromedio: number | null; sinScore: number };
    breadcrumb: { nivel: "pais" | "ciudad" | "colegio"; id: string; etiqueta: string }[];
}

export interface AnomaliaItem {
    id: string;
    tipo: string;
    severidad: "ALTA" | "MEDIA" | "BAJA" | string;
    descripcion: string;
    sujetoTipo: string | null;
    sujetoId: string | null;
    detectadaEn: string;
}

export interface AnomaliasRespuesta {
    items: AnomaliaItem[];
    pagination: Paginacion;
    disponible: boolean;
}
