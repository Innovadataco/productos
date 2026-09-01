import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Healthcheck del contenedor (D1): siempre dinámico y en runtime Node
// (Prisma no corre en edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EstadoDb = "conectada" | "no_configurada" | "error";

// Timeout corto: es un healthcheck, no debe colgar el contenedor (D1).
const TIMEOUT_DB_MS = 2500;

/**
 * Sondeo mínimo de la BD propia del 006. Jamás expone detalles de la
 * conexión ni el error crudo — solo un estado categórico.
 */
async function estadoDb(): Promise<EstadoDb> {
    if (!process.env.DATABASE_URL) return "no_configurada";
    try {
        const expiracion = new Promise<never>((_, rechazar) => {
            setTimeout(() => rechazar(new Error("timeout de sondeo")), TIMEOUT_DB_MS);
        });
        await Promise.race([prisma.$queryRaw`SELECT 1`, expiracion]);
        return "conectada";
    } catch {
        return "error";
    }
}

/**
 * Healthcheck público mínimo para Docker (D1) — sin datos sensibles.
 * Los chequeos detallados (réplica, MVs, Ollama) irán detrás de sesión
 * o de CRON_SECRET en Fase 2. Responde SIEMPRE 200: reporta el estado
 * en el cuerpo, no en el código HTTP.
 */
export async function GET() {
    const db = await estadoDb();
    return NextResponse.json({
        ok: true,
        servicio: "bi-006",
        fase: "1b-base-de-datos",
        hora: new Date().toISOString(),
        db,
    });
}
