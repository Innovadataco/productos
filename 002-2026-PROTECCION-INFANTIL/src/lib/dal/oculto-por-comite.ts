/**
 * SPEC-937 (I-451) · la marca del comité es la dueña ÚNICA de la visibilidad pública de un par.
 *
 * SPEC-110 hizo de `IdentificadorReportado.ocultoPorComiteEn` la decisión humana del comité al
 * ACEPTAR una apelación con «quitar la visibilidad pública» (`visibility.ts`: `esVisible =
 * !ocultoPorComiteEn && …`). Pero ese flag solo gobernaba a quien leía `esVisiblePublicamente`:
 * la consulta directa, las estadísticas públicas y el círculo de confianza leen los REPORTES por
 * identificador, nunca el agregado, así que seguían mostrando lo que el comité ocultó (I-451:
 * bandeja «se quitó la visibilidad» y `/api/consulta` con `tieneReportes=true`).
 *
 * Este módulo es la ÚNICA fuente del filtro para toda lectura PÚBLICA. La marca vive por PAR
 * (identificador, plataforma) —como la apelación—, así que se excluyen solo los reportes del par
 * oculto: el mismo identificador en otra plataforma sigue su regla normal. Las lecturas INTERNAS
 * (comité, operadores, colegio, scoring, match) NO lo usan: allí el reporte sigue completo como
 * evidencia. La marca la levanta SOLO un reporte nuevo real (`upsertIncrementoReporte`); un
 * simulacro no la toca (`reporte-creation.ts`, SPEC-863).
 */
import type { Prisma } from "@prisma/client";
import type { DbClient } from "./unit-of-work";

export interface ParOculto {
    identificador: string;
    plataformaId: string;
}

/** Pares (identificador, plataforma) ocultos por el comité; acotado a `identificadores` si se pasan. */
export async function paresOcultosPorComite(db: DbClient, identificadores?: readonly string[]): Promise<ParOculto[]> {
    if (identificadores && identificadores.length === 0) return [];
    return db.identificadorReportado.findMany({
        where: {
            ocultoPorComiteEn: { not: null },
            ...(identificadores ? { identificador: { in: [...identificadores] } } : {}),
        },
        select: { identificador: true, plataformaId: true },
    });
}

/**
 * Fragmento WHERE sobre Reporte que EXCLUYE los reportes de los pares ocultos por el comité.
 * `{}` si no hay ninguno. Se COMPONE con `conExclusion` (AND), nunca con spread: el where base
 * puede traer ya sus propias claves (`OR`, `NOT`, `id`) y un spread ciego las pisaría.
 */
export async function whereExcluirOcultosPorComite(
    db: DbClient,
    identificadores?: readonly string[],
): Promise<Prisma.ReporteWhereInput> {
    const pares = await paresOcultosPorComite(db, identificadores);
    return pares.length === 0 ? {} : { NOT: { OR: pares } };
}

/** `base` AND cada fragmento no vacío. Sin fragmentos devuelve `base` tal cual. */
export function conExclusion(base: Prisma.ReporteWhereInput, ...fragmentos: Prisma.ReporteWhereInput[]): Prisma.ReporteWhereInput {
    const reales = fragmentos.filter((f) => Object.keys(f).length > 0);
    return reales.length === 0 ? base : { AND: [base, ...reales] };
}

/** Agregados que cuentan en una superficie pública (los ocultos por el comité no). */
export const AGREGADO_NO_OCULTO = { ocultoPorComiteEn: null } satisfies Prisma.IdentificadorReportadoWhereInput;
