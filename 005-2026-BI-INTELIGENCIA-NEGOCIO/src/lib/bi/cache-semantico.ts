import { PrismaClient } from "@prisma/client";

export interface HitCacheSemantico {
    hit: true;
    sqlAprobado: string;
    entryId: string;
    similitud: number;
}

export type ResultadoCacheSemantico = HitCacheSemantico | null;

const UMBRAL_DEFAULT = 0.92;

function embeddingAVector(embedding: number[]): string {
    return `[${embedding.join(",")}]`;
}

export async function buscarSimilar(
    prisma: PrismaClient,
    embedding: number[] | null,
    umbral: number = UMBRAL_DEFAULT,
): Promise<ResultadoCacheSemantico> {
    if (!embedding || embedding.length === 0) return null;
    const vec = embeddingAVector(embedding);
    try {
        const rows = (await prisma.$queryRawUnsafe(
            `SELECT id, sql_aprobado, 1 - (embedding_pregunta <=> $1::vector) AS similitud
             FROM bi_cache_semantico
             WHERE embedding_pregunta IS NOT NULL
             ORDER BY embedding_pregunta <=> $1::vector
             LIMIT 1`,
            vec,
        )) as Array<{ id: string; sql_aprobado: string; similitud: number }>;
        if (!rows || rows.length === 0) return null;
        const [row] = rows;
        if (row.similitud < umbral) return null;
        return {
            hit: true,
            sqlAprobado: row.sql_aprobado,
            entryId: row.id,
            similitud: row.similitud,
        };
    } catch {
        return null;
    }
}

export interface EntradaAprobacion {
    preguntaNL: string;
    sql: string;
    aprobadoPor: string;
    embedding: number[];
    consultaLogId?: string;
}

export async function guardarAprobacion(
    prisma: PrismaClient,
    entrada: EntradaAprobacion,
): Promise<void> {
    const vec = embeddingAVector(entrada.embedding);
    await prisma.bICacheSemantico.upsert({
        where: { preguntaNL: entrada.preguntaNL },
        create: {
            preguntaNL: entrada.preguntaNL,
            sqlAprobado: entrada.sql,
            aprobadoPor: entrada.aprobadoPor,
            consultaLogId: entrada.consultaLogId,
        },
        update: {
            sqlAprobado: entrada.sql,
            aprobadoPor: entrada.aprobadoPor,
        },
    });
    await prisma.$executeRawUnsafe(
        `UPDATE bi_cache_semantico SET embedding_pregunta = $1::vector WHERE pregunta_nl = $2`,
        vec,
        entrada.preguntaNL,
    );
}
