import { config } from "dotenv";
import { PgBoss } from "pg-boss";
import { PrismaClient } from "@prisma/client";

config({ path: ".env" });
config({ path: ".env.local" });

const prisma = new PrismaClient();

async function main() {
    console.log("[Debug] Iniciando...");

    const boss = new PgBoss({
        connectionString: process.env.DATABASE_URL,
    });

    await boss.start();
    console.log("[Debug] pg-boss iniciado");

    await boss.work("process-document", async (job) => {
        console.log("[Debug] Handler llamado!");
        console.log("[Debug] Job completo:", JSON.stringify(job, null, 2));

        try {
            const docId = job.data?.documentId || job.documentId;
            console.log("[Debug] Buscando doc:", docId);

            const doc = await prisma.documentoOficial.findUnique({
                where: { id: docId },
            });

            console.log("[Debug] Doc encontrado:", doc ? "SI" : "NO");
            if (doc) {
                console.log("[Debug] Titulo:", doc.titulo);
            }

            return { success: true };
        } catch (err) {
            console.error("[Debug] ERROR:", err.message);
            throw err;
        }
    });

    console.log("[Debug] Worker suscrito, esperando...");

    // Mantener vivo
    setInterval(() => {
        console.log("[Debug] Heartbeat...");
    }, 10000);
}

main().catch((err) => {
    console.error("[Debug] Error fatal:", err);
    process.exit(1);
});