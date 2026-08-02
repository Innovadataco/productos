/**
 * SPEC-135 (E-2): tipos, constantes y helpers puros compartidos del módulo
 * circulo-confianza (antes en el god-module `circulo-confianza.ts`).
 * Uso interno del módulo — la API pública la reexporta `index.ts`.
 */
import { prisma } from "@/lib/prisma";
import type { EstadoReporte, Prisma } from "@prisma/client";

export type EstadoContacto = "sinReportes" | "enRevision" | "clasificado";

export type IdentificadorInput = {
    id?: string;
    valor: string;
    tipo?: string;
    plataformaId?: string;
};

export const ESTADOS_CLASIFICADOS: EstadoReporte[] = ["CLASIFICADO", "CORREGIDO"];
export const ESTADOS_REVISION: EstadoReporte[] = ["REVISION_MANUAL", "POSIBLE_SPAM", "REQUIERE_ANONIMIZACION"];
export const ESTADOS_VISIBLES: EstadoReporte[] = [...ESTADOS_CLASIFICADOS, ...ESTADOS_REVISION];

export interface DatosReporte {
    id: string;
    identificador: string;
    ciudad: string;
    pais: string;
    creadoEn: Date;
    fechaIncidente: Date | null;
    esAnonimo: boolean;
    plataforma: { id: string; nombre: string; clave: string };
    clasificacion: { categoria: string; confianza: number | null } | null;
    ciudadRel: { lat: number | null; lng: number | null } | null;
    estado: string;
}

export function formatFecha(date: Date | string | null) {
    if (!date) return "";
    return new Date(date).toISOString().slice(0, 10);
}

export function getClient(client?: Prisma.TransactionClient): Prisma.TransactionClient | typeof prisma {
    return client || prisma;
}
