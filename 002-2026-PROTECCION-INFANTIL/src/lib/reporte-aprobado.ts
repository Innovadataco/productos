import type { Prisma } from "@prisma/client";

/**
 * Predicado ÚNICO de "reporte aprobado" (spec 089-US3).
 *
 * Un reporte aprobado: estado ∈ {CLASIFICADO, CORREGIDO} ∧ categoría ∉ {SPAM, OTRO}
 * ∧ eliminado = false. Es la ÚNICA fuente de conteo: consulta pública, scoring y
 * dashboard usan esta misma definición (nunca duplicarla).
 *
 * Reglas del CEO: SPAM no cuenta/no muestra · CLASIFICADO con riesgo cuenta y muestra
 * · OTRO (sin riesgo, sin spam) no cuenta/no muestra.
 */

export const ESTADOS_APROBADOS = ["CLASIFICADO", "CORREGIDO"] as const;
export const CATEGORIAS_NO_APROBADAS = ["SPAM", "OTRO"] as const;

export function esReporteAprobado(
    reporte: { estado: string; eliminado: boolean },
    categoria?: string | null
): boolean {
    if (!(ESTADOS_APROBADOS as readonly string[]).includes(reporte.estado)) return false;
    if (reporte.eliminado) return false;
    if (!categoria) return false;
    return !(CATEGORIAS_NO_APROBADAS as readonly string[]).includes(categoria);
}

/**
 * Variante Prisma para filtros server-side (misma semántica que esReporteAprobado).
 * Requiere la clasificación asociada (ClasificacionIA es 1:1 con Reporte).
 */
export function whereReporteAprobado(extra: Prisma.ReporteWhereInput = {}): Prisma.ReporteWhereInput {
    return {
        ...extra,
        estado: { in: [...ESTADOS_APROBADOS] },
        eliminado: false,
        clasificacion: {
            is: {
                categoria: { notIn: [...CATEGORIAS_NO_APROBADAS] },
            },
        },
    };
}
