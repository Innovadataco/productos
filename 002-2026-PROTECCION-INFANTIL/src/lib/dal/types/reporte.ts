/**
 * SPEC-053: DTOs de dominio del agregado Reporte.
 * Son las formas exactas que las rutas devuelven hoy; las rutas reciben estos
 * DTOs de los servicios y NUNCA objetos crudos de Prisma (FR-007).
 */
import type { NivelRiesgo } from "@/lib/ranking";

export interface PaginationDto {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}

export interface RankingResumenDto {
    score: number;
    nivelRiesgo: NivelRiesgo;
    totalReportes: number;
}

export interface RankingPublicoDto {
    totalReportes: number;
    reportesAutenticados: number;
    reportesAnonimos: number;
}

export interface ClasificacionUsuarioDto {
    categoria: string;
    categoriaLabel: string;
    categoriaGrupo: string | null;
}

export interface ReporteListItemDto {
    id: string;
    identificador: string;
    plataforma: string;
    estadoInterno: string;
    estadoVisual: string;
    badge: string;
    enProceso: boolean;
    mensaje: string;
    slaHoras: number;
    numeroSeguimiento: string | null;
    ciudad: string | null;
    pais: string | null;
    esAnonimo: boolean;
    creadoEn: string;
    clasificacion: ClasificacionUsuarioDto | null;
    ranking: RankingResumenDto | null;
}

export interface MisReportesDto {
    items: ReporteListItemDto[];
    pagination: PaginationDto;
}

export interface SeguimientoClasificacionDto extends ClasificacionUsuarioDto {
    categoriasSecundarias: string[];
    contienePii: boolean | null;
}

export interface SeguimientoDto {
    numeroSeguimiento: string | null;
    estadoVisual: string;
    estadoInterno: string;
    badge: string;
    enProceso: boolean;
    mensaje: string;
    slaHoras: number;
    creadoEn: Date;
    actualizadoEn: Date;
    identificador: string;
    plataforma: string;
    clasificacion: SeguimientoClasificacionDto | null;
    actividad: "alta" | "baja" | null;
    ranking: RankingPublicoDto | null;
}

export interface ReporteDetallePadreDto {
    id: string;
    identificador: string;
    plataforma: string;
    ciudad: string | null;
    pais: string | null;
    creadoEn: string;
    estadoVisual: string;
    badge: string;
    enProceso: boolean;
}

export interface ConductaConfirmadaDto {
    categoria: string;
    label: string;
}

export interface DetallePadreDto {
    reporte: ReporteDetallePadreDto;
    clasificacion: {
        conductas: ConductaConfirmadaDto[];
        mensaje: string;
    } | null;
}
