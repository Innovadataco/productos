/**
 * SPEC-053 (data-model §1.3): DTOs del agregado Configuración.
 * Reflejan las formas exactas que las rutas de /api/config/parametros devuelven
 * hoy (los secretos siempre sanitizados a null fuera del flujo "revelar").
 */
import type { PaginationDto } from "./reporte";

export type TipoParametroDto = "STRING" | "INTEGER" | "FLOAT" | "BOOLEAN" | "JSON" | "STRING_ARRAY";
export type CategoriaParametroDto = "VISIBILITY" | "SECURITY" | "LEGAL" | "EMAIL" | "SYSTEM";

export interface ParametroDto {
    id: string;
    clave: string;
    valor: string | null;
    tipo: string;
    categoria: string;
    esPublico: boolean;
    esSecreto: boolean;
    descripcion: string | null;
    actualizadoPorId: string | null;
    creadoEn: Date;
    actualizadoEn: Date;
}

export interface ParametroListaDto {
    items: ParametroDto[];
    pagination: PaginationDto;
}

export interface ParametroHistorialItemDto {
    valorAnterior: string | null;
    valorNuevo: string | null;
    actualizadoPor: string | null | undefined;
    actualizadoEn: Date;
}

export interface ParametroDetalleDto extends ParametroDto {
    historial: ParametroHistorialItemDto[];
}

export interface ParametroPublicoValorDto {
    valor: unknown;
    tipo: string;
    descripcion: string | null;
}

export interface ParametroPatchInput {
    valor: string;
    tipo?: TipoParametroDto;
    categoria?: CategoriaParametroDto;
    esPublico?: boolean;
    esSecreto?: boolean;
    descripcion?: string;
    motivo?: string;
}
