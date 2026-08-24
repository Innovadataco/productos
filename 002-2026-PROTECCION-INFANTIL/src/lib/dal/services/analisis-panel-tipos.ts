/**
 * SPEC-222 (002-PI-123): tipos de respuesta del servicio del panel Dinero vs
 * Valor (contratos/222-panel-analisis.md). Separados de `analisis-panel.ts`
 * por el techo de 500 líneas por archivo (E-8).
 */
import type { TipoTitular } from "@prisma/client";
import type { Cuadrante, Semaforo } from "@/lib/analisis/panel-calculos";
import type { GranularidadPanel } from "@/lib/schemas/analisis-panel";

export interface TopDecisionItem {
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

export interface FilaGranularidad {
    clave: string;
    etiqueta: string;
    suscripciones: number;
    recaudoUSD: number;
    scorePromedio: number | null;
    variacionRecaudoPct: number | null;
    semaforo: Semaforo;
    drill: { granularidad: GranularidadPanel; params: Record<string, string> } | null;
    /** Suscripción destino del drill hoja (vista cliente SPEC-211); null si no aplica. */
    suscripcionId: string | null;
    /** Solo granularidad cohorte. */
    retenidosPct?: number;
    /** Solo granularidad plan. */
    renovacionPct?: number;
}

export interface Paginacion {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface ResultadoDineroVsValor {
    items: FilaGranularidad[];
    pagination: Paginacion;
    totales: { suscripciones: number; recaudoUSD: number; scorePromedio: number | null; sinScore: number };
    breadcrumb: { nivel: "pais" | "ciudad" | "colegio"; id: string; etiqueta: string }[];
}

export interface PuntoDispersion {
    suscripcionId: string;
    cliente: string;
    tipoTitular: TipoTitular;
    montoUSD: number;
    scoreTotal: number;
    cuadrante: Cuadrante;
}

export interface ResultadoDispersion {
    puntos: PuntoDispersion[];
    cortes: { montoUSD: number; score: number; fuente: "mediana" | "parametro" };
    truncado: boolean;
    totalSuscripciones: number;
    sinScore: number;
}

export interface KpiValor {
    valor: number;
    deltaPct: number | null;
}

export interface ResultadoKpis {
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

export interface AnomaliaItem {
    id: string;
    tipo: string;
    severidad: string;
    descripcion: string;
    sujetoTipo: string | null;
    sujetoId: string | null;
    detectadaEn: string;
}

export interface ResultadoAnomalias {
    items: AnomaliaItem[];
    pagination: Paginacion;
    disponible: boolean;
}
