/**
 * SPEC-053 (US2): DTOs de la Consulta pública.
 * Reflejan EXACTAMENTE las respuestas actuales de GET/POST /api/consulta y
 * /api/consulta/detalle. Sin score ni juicio sobre la persona (spec 089-US6):
 * solo hechos agregados; el detalle autenticado incluye nivelRiesgo descriptivo
 * del módulo existente `src/lib/riesgo-consulta.ts`.
 */

export interface ConsultaPlataformaDto {
    id: string;
    nombre: string;
    clave: string;
    total: number;
    otraPlataforma: string | null;
}

export interface ConsultaCategoriaDto {
    categoria: string;
    total: number;
}

export interface ConsultaUbicacionAnonimaDto {
    pais: string;
    total: number;
}

export interface ConsultaUbicacionDetalleDto {
    pais: string;
    departamento?: string | null;
    ciudad: string;
    total: number;
    lat: number | null;
    lng: number | null;
}

export interface ConsultaTimelineDto {
    mes: string;
    total: number;
}

/** Resumen público; los campos de detalle solo van si `autenticado` (US5/US7). */
export interface ConsultaResumenDto {
    identificador: string;
    tieneReportes: boolean;
    mensaje?: string;
    visibleEnDashboard?: boolean;
    actividad?: "alta" | "baja";
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    plataformas?: ConsultaPlataformaDto[];
    resumenPlataformas?: string;
    categorias?: ConsultaCategoriaDto[];
    ubicaciones?: Array<ConsultaUbicacionAnonimaDto | ConsultaUbicacionDetalleDto>;
    autenticado?: boolean;
    primerReporte?: string | null;
    ultimoReporte?: string | null;
    timeline?: ConsultaTimelineDto[];
    resumen?: string;
}

export interface ConsultaDetalleItemDto {
    id: string;
    plataforma: string;
    esAnonimo: boolean;
    fecha: string;
    categoria: string;
    categoriaLabel: string;
    categoriaGrupo: string | null;
    nivelRiesgo: string;
}

export interface ConsultaDetalleDto {
    identificador: string;
    tieneReportes: boolean;
    mensaje?: string;
    nivelRiesgo?: string;
    totalReportes?: number;
    reportesAutenticados?: number;
    reportesAnonimos?: number;
    ultimoReporte?: string | null;
    plataformas?: ConsultaPlataformaDto[];
    resumenPlataformas?: string;
    reportes?: ConsultaDetalleItemDto[];
    ubicaciones?: ConsultaUbicacionDetalleDto[];
}
