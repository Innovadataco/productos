/**
 * SPEC-245 (002-PI-148): tipos compartidos entre el panel admin de activación
 * manual y el modal de captura de pago. Módulo puro (sin imports de runtime
 * de Prisma) para no arrastrar el cliente de BD al bundle del navegador.
 */

export type TipoTarget = "PADRE" | "COLEGIO";

export interface TargetSinSuscripcion {
    id: string;
    tipo: TipoTarget;
    nombre: string;
    email?: string;
    identificacion?: string;
}

export interface PlanManualDTO {
    id: string;
    nombre: string;
    tipoTitular: TipoTarget;
    duracion: string;
    anio: number;
    precioBaseCOP: number | null;
    precioBaseUSD: number;
    esFreemium: boolean;
    activo: boolean;
    descripcion: string | null;
}

export interface TitularSolicitudDTO {
    id: string;
    tipo: TipoTarget;
    nombre: string;
    email?: string;
}

export interface PlanSolicitudDTO {
    id: string;
    nombre: string;
    duracion: string;
}

export interface SolicitudPendienteDTO {
    id: string;
    estado: string;
    tipoTitular: TipoTarget;
    fechaInicio: string;
    fechaFin: string;
    plan: PlanSolicitudDTO;
    titular: TitularSolicitudDTO;
}

export interface PaginacionDTO {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
}
