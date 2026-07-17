import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    const indexes = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename IN ('EmbeddingReporte', 'EmbeddingDataset')
          AND indexname LIKE '%vector%'
        ORDER BY tablename, indexname;
    `;
    console.log("=== Índices vectoriales ===");
    console.log(JSON.stringify(indexes, null, 2));

    const explain = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SET LOCAL enable_seqscan = off;`;
        return tx.$queryRaw`
            EXPLAIN (FORMAT TEXT)
            SELECT "reporteId", 1 - (vector <=> (SELECT vector FROM "EmbeddingReporte" LIMIT 1)::vector) AS similarity
            FROM "EmbeddingReporte"
            ORDER BY vector <=> (SELECT vector FROM "EmbeddingReporte" LIMIT 1)::vector
            LIMIT 5;
        `;
    });
    console.log("=== EXPLAIN (enable_seqscan=off) ===");
    console.log((explain as { ["QUERY PLAN"]: string }[]).map((r) => r["QUERY PLAN"]).join("\n"));
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
