#!/usr/bin/env tsx
import { prisma } from "@/lib/prisma";

async function main() {
    await prisma.$executeRaw`DROP INDEX IF EXISTS "EmbeddingDataset_vector_idx"`;
    await prisma.$executeRaw`DROP INDEX IF EXISTS "EmbeddingReporte_vector_idx"`;
    console.log("Índices btree de vector eliminados.");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
