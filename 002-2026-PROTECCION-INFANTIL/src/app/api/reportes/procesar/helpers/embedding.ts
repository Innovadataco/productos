import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function guardarEmbedding(reporteId: string, modeloEmbedding: string, vector: number[]): Promise<void> {
    const vectorStr = "[" + vector.join(",") + "]";
    const embeddingExistente = await prisma.embeddingReporte.findUnique({
        where: { reporteId },
    });
    if (!embeddingExistente) {
        const embeddingId = crypto.randomUUID();
        try {
            await prisma.$executeRaw`
                INSERT INTO "EmbeddingReporte" (id, "reporteId", vector, "modeloUsado", "creadoEn")
                VALUES (${embeddingId}, ${reporteId}, ${vectorStr}::vector, ${modeloEmbedding}, NOW())
            `;
        } catch (err) {
            // Idempotencia ante concurrencia/reintento: si otro proceso creó el embedding, se conserva.
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
                console.warn(`[PROCESAR] Embedding ya existía para reporte ${reporteId}, se conserva.`);
            } else {
                throw err;
            }
        }
    }
}
