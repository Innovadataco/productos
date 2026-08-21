/**
 * SPEC-053 (FR-006, D3): EmbeddingRepository — adaptador de infraestructura
 * para pgvector. La raw query de inserción vive AQUÍ, nunca en rutas ni en
 * servicios genéricos. Acepta un cliente transaccional opcional (D2).
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { DbClient } from "../unit-of-work";

export class EmbeddingRepository {
    private readonly db: DbClient;

    constructor(tx?: Prisma.TransactionClient) {
        this.db = tx ?? prisma;
    }

    /**
     * Inserta el embedding de un reporte. Idempotente ante concurrencia/reintento:
     * si otro proceso ya lo creó (P2002), se conserva el existente.
     */
    async insertReporteEmbedding(reporteId: string, modeloEmbedding: string, vector: number[]): Promise<void> {
        const embeddingExistente = await this.db.embeddingReporte.findUnique({
            where: { reporteId },
        });
        if (embeddingExistente) return;

        const vectorStr = "[" + vector.join(",") + "]";
        const embeddingId = crypto.randomUUID();
        try {
            await this.db.$executeRaw`
                INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
                VALUES (${embeddingId}, ${reporteId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
            `;
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                console.warn(`[PROCESAR] Embedding ya existía para reporte ${reporteId}, se conserva.`);
            } else {
                throw err;
            }
        }
    }

    /**
     * E-8 (D3): upsert del embedding del reporte — si existe, ACTUALIZA vector y
     * modelo (regeneración tras anonimizar/validar); si no, inserta. Misma raw
     * que las rutas hacían inline.
     */
    async upsertReporteEmbedding(reporteId: string, modeloEmbedding: string, vector: number[]): Promise<void> {
        const vectorStr = "[" + vector.join(",") + "]";
        const embeddingExistente = await this.db.embeddingReporte.findUnique({
            where: { reporteId },
        });
        if (embeddingExistente) {
            await this.db.$executeRaw`
                UPDATE "EmbeddingReporte"
                SET vector = ${vectorStr}::vector, "modeloUsado" = ${modeloEmbedding}
                WHERE "reporteId" = ${reporteId}
            `;
        } else {
            const embeddingId = crypto.randomUUID();
            await this.db.$executeRaw`
                INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
                VALUES (${embeddingId}, ${reporteId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
            `;
        }
    }

    /**
     * E-8 (D3): inserta el embedding de un registro del dataset (misma raw que las
     * rutas hacían inline). Sin guarda de idempotencia: el llamador decide su
     * política de reintento (la ruta de correcciones lo envuelve en try/catch).
     */
    async insertDatasetEmbedding(datasetId: string, modeloEmbedding: string, vector: number[]): Promise<void> {
        const vectorStr = "[" + vector.join(",") + "]";
        await this.db.$executeRaw`
            INSERT INTO "EmbeddingDataset" (id, "datasetId", vector, "modeloUsado", "creadoEn")
            VALUES (${crypto.randomUUID()}, ${datasetId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
        `;
    }

    /**
     * E-8 (D3): ejemplos del dataset cercanos al embedding (RAG del clasificador).
     * Devuelve los candidatos con similitud >= umbral ordenados por cercanía;
     * el filtro anti-leakage (excluirSimilitudMayorA) lo aplica el llamador.
     */
    buscarEjemplosSimilaresDataset(
        embedding: number[],
        opciones: { topK: number; umbral: number }
    ): Promise<{ id: string; texto: string; clasificacionCorrecta: string; similitud: number }[]> {
        const vectorStr = "[" + embedding.join(",") + "]";
        return this.db.$queryRaw<{ id: string; texto: string; clasificacionCorrecta: string; similitud: number }[]>`
            SELECT d.id, d.texto, d."clasificacionCorrecta", 1 - (e.vector <=> ${vectorStr}::vector) AS similitud
            FROM "DatasetEntrenamiento" d
            JOIN "EmbeddingDataset" e ON e."datasetId" = d.id
            WHERE 1 - (e.vector <=> ${vectorStr}::vector) >= ${opciones.umbral}
            ORDER BY e.vector <=> ${vectorStr}::vector ASC
            LIMIT ${opciones.topK}
        `;
    }

    /**
     * E-8 (D3): reporte más similar por embedding para el mismo identificador +
     * plataforma (deduplicación). Excluye DUPLICADO/POSIBLE_SPAM y el propio reporte.
     */
    async buscarReporteSimilarPorEmbedding(
        embedding: number[],
        filtro: { reporteId: string; identificador: string; plataformaId: string; threshold: number }
    ): Promise<{ reporteId: string; similarity: number } | null> {
        const vectorStr = "[" + embedding.join(",") + "]";
        const result = await this.db.$queryRaw<{ reporteId: string; similarity: number }[]>`
            SELECT e."reporteId", 1 - (e.vector <=> ${vectorStr}::vector) AS similarity
            FROM "EmbeddingReporte" e
            JOIN "Reporte" r ON r.id = e."reporteId"
            WHERE r.identificador = ${filtro.identificador}
              AND r."plataformaId" = ${filtro.plataformaId}
              AND r.estado NOT IN ('DUPLICADO', 'POSIBLE_SPAM')
              AND r.id != ${filtro.reporteId}
              AND 1 - (e.vector <=> ${vectorStr}::vector) >= ${filtro.threshold}
            ORDER BY similarity DESC
            LIMIT 1
        `;
        return result[0] || null;
    }

    /**
     * SPEC-195 (002-PI-089): candidatos a patrón coordinado. Reportes recientes
     * con embedding similar al texto actual, excluyendo el propio reporte.
     */
    async buscarPatronCoordinadoCandidatos(
        embedding: number[],
        opciones: { reporteId: string; modeloEmbedding: string; umbral: number; ventana: Date }
    ): Promise<{ id: string; identificador: string; similitud: number }[]> {
        const vectorStr = "[" + embedding.join(",") + "]";
        return this.db.$queryRaw<{ id: string; identificador: string; similitud: number }[]>`
            SELECT r.id, r.identificador, 1 - (e.vector <=> ${vectorStr}::vector) AS similitud
            FROM "EmbeddingReporte" e
            JOIN "Reporte" r ON r.id = e."reporteId"
            WHERE e."reporteId" != ${opciones.reporteId}
              AND r.eliminado = false
              AND e."modeloUsado" = ${opciones.modeloEmbedding}
              AND r."creadoEn" >= ${opciones.ventana}
              AND 1 - (e.vector <=> ${vectorStr}::vector) >= ${opciones.umbral}
            ORDER BY e.vector <=> ${vectorStr}::vector ASC
        `;
    }

    /**
     * E-8 (D3): similitud máxima contra reportes del mismo identificador +
     * plataforma, sin filtro de umbral (traza del expediente, spec 096).
     */
    async buscarSimilitudMaximaPorEmbedding(
        embedding: number[],
        filtro: { reporteId: string; identificador: string; plataformaId: string }
    ): Promise<number | null> {
        const vectorStr = "[" + embedding.join(",") + "]";
        const result = await this.db.$queryRaw<{ similarity: number }[]>`
            SELECT 1 - (e.vector <=> ${vectorStr}::vector) AS similarity
            FROM "EmbeddingReporte" e
            JOIN "Reporte" r ON r.id = e."reporteId"
            WHERE r.identificador = ${filtro.identificador}
              AND r."plataformaId" = ${filtro.plataformaId}
              AND r.estado NOT IN ('DUPLICADO', 'POSIBLE_SPAM')
              AND r.id != ${filtro.reporteId}
            ORDER BY e.vector <=> ${vectorStr}::vector ASC
            LIMIT 1
        `;
        return result[0]?.similarity ?? null;
    }
}
