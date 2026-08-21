/**
 * SPEC-053 (US3, módulo Operadores): DTOs de Operadores y asignación.
 */
import type { Prisma } from "@prisma/client";

export type OperadorConPerfil = Prisma.UsuarioGetPayload<{ include: { perfilOperador: true } }>;

export interface InfoClienteDto {
    ipAddress: string;
    userAgent: string;
}

export interface OperadorPerfilDto {
    cupoMaximo: number | null;
    esRevisorDeApelaciones: boolean;
    esComite: boolean;
    notasInternas: string | null;
    creadoPorId: string | null;
    ultimoEmailNotificacionEn: Date | null;
}

export interface OperadorListItemDto {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    estado: string;
    debeCambiarPassword: boolean;
    tenantId: string | null;
    perfil: OperadorPerfilDto | null;
    casosAbiertos: number;
    casosTotales: number;
}

export interface OperadorCreadoDto {
    id: string;
    email: string;
    nombre: string | null;
    rol: string;
    estado: string;
    debeCambiarPassword: boolean;
    perfil: OperadorConPerfil["perfilOperador"];
}

export type ResultadoCrearOperador =
    | { ok: true; operador: OperadorCreadoDto; accionAudit: "OPERADOR_CREADO" | "COMITE_CREADO" }
    | { ok: false; tipo: "email_existente" }
    | { ok: false; tipo: "rol_distinto"; rolExistente: string; rolNuevo: string };

export interface ModeloAsignacionDto {
    cupoMaximoDefault: number;
    estrategia: string;
}

export interface OperadorAsignacionItemDto {
    id: string;
    email: string;
    nombre: string | null;
    esRevisorDeApelaciones: boolean;
    casosAbiertos: number;
    cupoMaximo: number;
    libre: number;
}

export interface PanelAsignacionDto {
    sinAsignar: number;
    operadores: OperadorAsignacionItemDto[];
    estrategia: string;
    cupoDefault: number;
}

/** SPEC-189 (002-PI-084): métricas de productividad de un operador. */
export interface CasoAbiertoMetricaDto {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    categoria: string | null;
    estado: string;
    asignadoEn: Date;
    tiempoDesdeAsignacionMs: number;
}

export interface CategoriaConteoDto {
    categoria: string;
    total: number;
}

export interface MetricasOperadorDto {
    operador: {
        id: string;
        email: string;
        nombre: string | null;
        cupoMaximo: number;
    };
    casosAbiertos: CasoAbiertoMetricaDto[];
    casosResueltos24h: number;
    casosResueltos7d: number;
    casosResueltos30d: number;
    tiempoMedioResolucionMs: number | null;
    casosPorCategoria: CategoriaConteoDto[];
    tasaEscalamientoComite: number | null;
}

/** SPEC-189 (002-PI-084): ítem de caso en el listado de un operador. */
export interface CasoOperadorListItemDto {
    id: string;
    numeroSeguimiento: string | null;
    identificador: string;
    plataformaClave: string;
    plataformaNombre: string;
    estado: string;
    categoria: string | null;
    asignadoEn: Date;
}
