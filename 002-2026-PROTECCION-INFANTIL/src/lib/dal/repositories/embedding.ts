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
}
