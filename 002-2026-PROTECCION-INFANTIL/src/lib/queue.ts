import { PgBoss } from "pg-boss";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL requerida");

const boss = new PgBoss(DATABASE_URL);
let started = false;

async function ensureStarted() {
    if (!started) {
        await boss.start();
        started = true;
    }
}

export async function publishReporte(reporteId: string) {
    await ensureStarted();
    try {
        await boss.createQueue("reporte-procesamiento");
    } catch {
        // Cola ya existe, ignorar
    }
    await boss.send("reporte-procesamiento", { reporteId }, {
        retryLimit: 3,
        retryDelay: 30,
        retryBackoff: true,
    });
}

export async function publishDatasetAnonimizacionBackfill(datasetId: string) {
    await ensureStarted();
    try {
        await boss.createQueue("dataset-anonimizacion-backfill");
    } catch {
        // Cola ya existe, ignorar
    }
    await boss.send("dataset-anonimizacion-backfill", { datasetId }, {
        retryLimit: 5,
        retryDelay: 60,
        retryBackoff: true,
    });
}

export async function publishDatasetEmbeddingBackfill(datasetId: string) {
    await ensureStarted();
    try {
        await boss.createQueue("dataset-embedding-backfill");
    } catch {
        // Cola ya existe, ignorar
    }
    await boss.send("dataset-embedding-backfill", { datasetId }, {
        retryLimit: 5,
        retryDelay: 60,
        retryBackoff: true,
    });
}