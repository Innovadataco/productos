import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

const REQUIRED = [
    { name: "EmbeddingReporte_vector_idx", table: "EmbeddingReporte" },
    { name: "EmbeddingDataset_vector_idx", table: "EmbeddingDataset" },
];

async function main() {
    const rows = await prisma.$queryRaw<{ indexname: string; indexdef: string }[]>`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname IN (${Prisma.join(REQUIRED.map((r) => r.name))})
    `;

    const byName = new Map(rows.map((r) => [r.indexname, r.indexdef]));
    let ok = true;

    for (const req of REQUIRED) {
        const def = byName.get(req.name);
        if (!def) {
            console.error(`[VERIFY HNSW] FALTA: ${req.name}`);
            ok = false;
        } else if (!def.toLowerCase().includes("using hnsw")) {
            console.error(`[VERIFY HNSW] NO ES HNSW: ${req.name} -> ${def}`);
            ok = false;
        } else {
            console.log(`[VERIFY HNSW] OK: ${req.name}`);
        }
    }

    if (!ok) {
        console.error("[VERIFY HNSW] Índices HNSW requeridos no encontrados.");
        process.exitCode = 1;
    } else {
        console.log("[VERIFY HNSW] Todos los índices HNSW están presentes.");
    }
}

main()
    .catch((error) => {
        console.error("[VERIFY HNSW] Error:", error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
