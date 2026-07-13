import { PgBoss } from "pg-boss";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) throw new Error("DATABASE_URL requerida");

export const boss = new PgBoss(DATABASE_URL);

export async function startQueue() {
    await boss.start();
}

export async function publishReporte(reporteId: string) {
    await boss.send("reporte-procesamiento", { reporteId });
}