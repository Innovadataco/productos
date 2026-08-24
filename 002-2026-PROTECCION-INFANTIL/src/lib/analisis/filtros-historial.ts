/**
 * SPEC-227 (002-PI-128): filtros compartidos del historial de recomendaciones.
 * Un único schema Zod para los tres endpoints (lista, métricas, export):
 * "lo que ves es lo que exportas" (plan §2.2). Módulo PURO (sin Prisma):
 * las fechas `desde`/`hasta` se interpretan como día calendario
 * America/Bogota (D-69) y se resuelven a instantes UTC para el `where`.
 */
import { z } from "zod";
import { fromZonedTime } from "date-fns-tz";
import type { EstadoRecomendacion } from "@prisma/client";
import { ZONA_BOGOTA } from "./periodos";

export const ESTADOS_RECOMENDACION = ["PENDIENTE", "APLICADA", "IGNORADA", "EXPIRADA"] as const;
export const SUJETO_TIPOS = ["Suscripcion", "Colegio", "Usuario"] as const;

const PATRON_FECHA_DIA = /^\d{4}-\d{2}-\d{2}$/;

/** "2026-02-30" pasa el regex pero no existe: validación de día real. */
function esDiaValido(dia: string): boolean {
    if (!PATRON_FECHA_DIA.test(dia)) return false;
    const [anio, mes, d] = dia.split("-").map((p) => parseInt(p, 10)) as [number, number, number];
    const fecha = new Date(Date.UTC(anio, mes - 1, d));
    return fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === d;
}

const diaSchema = z
    .string()
    .refine(esDiaValido, { message: "fecha inválida (formato YYYY-MM-DD, día calendario real)" });

/** Query params comunes de lista / métricas / export (contracts §Filtros comunes). */
export const filtrosHistorialSchema = z
    .object({
        estado: z.enum(ESTADOS_RECOMENDACION).optional(),
        reglaId: z.string().min(1).max(100).optional(),
        categoria: z.string().min(1).max(50).optional(),
        sujetoTipo: z.enum(SUJETO_TIPOS).optional(),
        sujetoId: z.string().min(1).max(100).optional(),
        ejecutadaAutomatica: z.enum(["true", "false"]).optional(),
        desde: diaSchema.optional(),
        hasta: diaSchema.optional(),
    })
    .refine((f) => !f.desde || !f.hasta || f.desde <= f.hasta, {
        message: "El rango de fechas es inválido: 'desde' no puede ser posterior a 'hasta'",
    });

export type FiltrosHistorialQuery = z.infer<typeof filtrosHistorialSchema>;

/**
 * Filtros ya resueltos para la capa DAL: `ejecutadaAutomatica` como boolean y
 * el rango convertido a instantes UTC (día calendario Bogotá: desde 00:00:00.000,
 * hasta 23:59:59.999 — la frontera del día "hasta" queda incluida).
 */
export interface FiltrosHistorial {
    estado?: EstadoRecomendacion | undefined;
    reglaId?: string | undefined;
    categoria?: string | undefined;
    sujetoTipo?: string | undefined;
    sujetoId?: string | undefined;
    ejecutadaAutomatica?: boolean | undefined;
    generadaDesdeUtc?: Date | undefined;
    generadaHastaUtc?: Date | undefined;
}

/** Convierte un día "YYYY-MM-DD" al instante UTC de sus 00:00:00.000 Bogotá. */
export function inicioDiaBogotaUtc(dia: string): Date {
    return fromZonedTime(`${dia}T00:00:00.000`, ZONA_BOGOTA);
}

/** Convierte un día "YYYY-MM-DD" al instante UTC de sus 23:59:59.999 Bogotá. */
export function finDiaBogotaUtc(dia: string): Date {
    return fromZonedTime(`${dia}T23:59:59.999`, ZONA_BOGOTA);
}

/** Resuelve los query params validados a filtros listos para el DAL. */
export function resolverFiltros(query: FiltrosHistorialQuery): FiltrosHistorial {
    return {
        estado: query.estado,
        reglaId: query.reglaId,
        categoria: query.categoria,
        sujetoTipo: query.sujetoTipo,
        sujetoId: query.sujetoId,
        ejecutadaAutomatica:
            query.ejecutadaAutomatica === undefined ? undefined : query.ejecutadaAutomatica === "true",
        generadaDesdeUtc: query.desde ? inicioDiaBogotaUtc(query.desde) : undefined,
        generadaHastaUtc: query.hasta ? finDiaBogotaUtc(query.hasta) : undefined,
    };
}

/** Parsea `URLSearchParams` contra el schema compartido (lanza ZodError → 400). */
export function parsearFiltrosDesdeSearchParams(searchParams: URLSearchParams): FiltrosHistorialQuery {
    const crudo: Record<string, string> = {};
    for (const clave of [
        "estado",
        "reglaId",
        "categoria",
        "sujetoTipo",
        "sujetoId",
        "ejecutadaAutomatica",
        "desde",
        "hasta",
    ] as const) {
        const valor = searchParams.get(clave);
        if (valor !== null && valor !== "") crudo[clave] = valor;
    }
    return filtrosHistorialSchema.parse(crudo);
}
