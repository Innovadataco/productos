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
}
