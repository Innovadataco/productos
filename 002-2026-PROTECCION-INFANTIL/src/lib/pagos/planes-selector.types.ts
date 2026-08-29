/**
 * SPEC-244 (002-PI-147): tipos compartidos entre el selector de planes del
 * cliente y las páginas server-side de suscripción. Módulo puro (sin imports de
 * runtime de Prisma) para no arrastrar el cliente al bundle del navegador.
 */

export type DuracionPlanSelector = "MES_1" | "MES_3" | "MES_6" | "MES_12";

export interface PlanSelectorDTO {
    id: string;
    nombre: string;
    descripcion: string | null;
    duracion: DuracionPlanSelector | string;
    precioBaseCOP: number;
    precioBaseUSD: number;
    descuentoAnualPct: number | null;
    esFreemium: boolean;
    activo: boolean;
}

export interface UsuarioSelector {
    id: string;
    rol: "PARENT" | "SCHOOL_ADMIN";
    nombre: string | null;
    email: string;
}

export type ColorRolSelector = "cielo" | "pino";

export interface SuscripcionPendienteDTO {
    id: string;
    estado: string;
    fechaInicio: string;
    fechaFin: string;
    plan: {
        nombre: string;
    };
}
