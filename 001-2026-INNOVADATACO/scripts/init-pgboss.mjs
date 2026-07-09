import { config } from "dotenv";
import { PgBoss } from "pg-boss";

// Cargar ambos archivos de entorno
config({ path: ".env" });
config({ path: ".env.local" });

async function main() {
    console.log("Inicializando pg-boss...");
    const boss = new PgBoss({
        connectionString: process.env.DATABASE_URL,
    });

    // start() crea las tablas necesarias
    await boss.start();
    console.log("pg-boss iniciado, tablas creadas");

    // Verificar que la cola existe
    await boss.createQueue("process-document");
    console.log("Cola process-document creada");

    await boss.stop();
    console.log("pg-boss detenido. Schema inicializado correctamente.");
}

main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
});