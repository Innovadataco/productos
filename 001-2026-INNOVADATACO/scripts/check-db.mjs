import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";

config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    console.log("=== Documentos recientes ===");
    const docs = await prisma.documentoOficial.findMany({
        orderBy: { createdAt: "desc" },
        take: 5,
    });
    docs.forEach((d) => {
        console.log(`ID: ${d.id}`);
        console.log(`  Status: ${d.status}`);
        console.log(`  Titulo: ${d.titulo}`);
        console.log(`  Error: ${d.processingError || "Ninguno"}`);
        console.log(`  Creado: ${d.createdAt}`);
        console.log("---");
    });

    console.log("\n=== Verificando tablas pg-boss ===");
    try {
        const tables = await prisma.$queryRawUnsafe(
            `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'pgboss%'`
        );
        console.log("Tablas encontradas:", tables);
    } catch (e) {
        console.error("Error:", e.message);
    }

    await prisma.$disconnect();
}

main();