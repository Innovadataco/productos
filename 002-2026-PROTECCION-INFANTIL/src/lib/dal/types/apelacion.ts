/**
 * SPEC-053 (US3, módulo Apelaciones): DTOs de Apelación (SPEC-110).
 * Regla dura: el apelante NO ve contenido de ningún reporte; solo el conteo
 * derivado `numeroReportesAsociados`.
 */
import type { PaginationDto } from "./reporte";

export interface ApelacionCreadaDto {
    id: string;
    numero: string;
    estado: string;
    plazoRespuestaEn: Date | null;
    creadoEn: Date;
    numeroReportesAsociados: number;
}

export interface ApelacionMiaDto {
    id: string;
    numero: string;
    identificador: string;
    plataforma: { nombre: string; clave: string };
    estado: string;
    esRepresentante: boolean;
    creadoEn: Date;
    plazoRespuestaEn: Date | null;
    decision: string | null;
    motivacionResolucion: string | null;
    resueltoEn: Date | null;
    numeroReportesAsociados: number;
    documentoNombre: string | null;
    documentoEliminadoEn: Date | null;
}

export interface MisApelacionesDto {
    items: ApelacionMiaDto[];
    pagination: PaginationDto;
}

export type ResultadoPreparacionRadicacion =
    | { ok: true }
    | { ok: false; tipo: "plataforma_invalida" | "conflicto" | "sin_reportes" };
