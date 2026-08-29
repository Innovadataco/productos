import type { EstadoReporte, Prisma } from "@prisma/client";
import {
    whereReporteAprobado,
    ESTADOS_APROBADOS,
    CATEGORIAS_NO_APROBADAS,
} from "@/lib/reporte-aprobado";

/**
 * Capa central de predicados de acceso a reportes (SPEC-122, bloque R4).
 *
 * ÚNICA fuente del filtro "reporte vigente" (`eliminado: false`) en las rutas API.
 * Hasta SPEC-122 ese filtro estaba escrito a mano en ~29 copias dentro de
 * `src/app/api/**` (39 en todo `src`), y las copias divergían: la fuga de PII
 * (I-28) fue exactamente eso. Toda consulta Prisma sobre `Reporte` que excluya
 * bajas lógicas DEBE construirse con estos predicados.
 *
 * Equivalencia: cada predicado devuelve un `Prisma.ReporteWhereInput` plano con
 * exactamente las mismas claves y valores que la copia manual que reemplaza, por
 * lo que el SQL generado es idéntico (demostrado en `reportes-acceso.test.ts`).
 *
 * Reglas:
 * - `extra` NO debe incluir `eliminado` ni `estado` (los predicados los fijan y
 *   pisan cualquier valor recibido: el filtro de vigencia no es negociable).
 * - El objeto devuelto también sirve como filtro de relación anidado
 *   (`clasificacion: { reporte: whereReporteVigente() }`).
 * - "Aprobado" (estado + categoría + vigencia) NO se redefine aquí: se reutiliza
 *   `whereReporteAprobado` de `src/lib/reporte-aprobado.ts` (reexportado abajo
 *   para que las rutas tengan un único punto de importación).
 */

// Reexportación deliberada (no duplicación): mismo objeto de función.
export { whereReporteAprobado, ESTADOS_APROBADOS, CATEGORIAS_NO_APROBADAS };

/**
 * Reporte vigente (no eliminado), sin filtro de estado.
 * Reemplaza las copias manuales de `{ eliminado: false }` y
 * `{ ...filtros, eliminado: false }`.
 */
export function whereReporteVigente(extra: Prisma.ReporteWhereInput = {}): Prisma.ReporteWhereInput {
    return { ...extra, eliminado: false };
}

/**
 * Reporte vigente en UN estado concreto (p. ej. "REVISION_MANUAL").
 * Reemplaza `{ estado: "X", ...filtros, eliminado: false }`.
 */
export function whereReporteEnEstado(
    estado: EstadoReporte,
    extra: Prisma.ReporteWhereInput = {}
): Prisma.ReporteWhereInput {
    return { ...extra, estado, eliminado: false };
}

/**
 * Reporte vigente en un conjunto de estados.
 * Reemplaza `{ estado: { in: [...] }, ...filtros, eliminado: false }`.
 * OJO: no filtra categoría; para "aprobado" usar `whereReporteAprobado`.
 */
export function whereReporteEnEstados(
    estados: readonly EstadoReporte[],
    extra: Prisma.ReporteWhereInput = {}
): Prisma.ReporteWhereInput {
    return { ...extra, estado: { in: [...estados] }, eliminado: false };
}
