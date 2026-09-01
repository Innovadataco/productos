import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Healthcheck del contenedor (D1): siempre dinámico y en runtime Node
// (Prisma no corre en edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type EstadoDb = "conectada" | "no_configurada" | "error";
type EstadoReplica = "activa" | "sin_configurar" | "error";

// Los conteos opcionales se omiten (undefined) cuando su sondeo falla:
// nunca se inventa un dato que no se pudo medir (candado 9).
type SaludReplica = {
    estado: EstadoReplica;
    tablasReplicando?: number;
    mvPobladas?: number;
    mvTotales?: number;
};

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
 * Salud de la réplica read-only de PI y de las MVs `mv_fact_*` (§4: el
 * healthcheck de BI v2 DEBE detectar MVs rotas y réplica desactualizada).
 *
 * Degrada con gracia: cada sondeo lleva su propio try/catch porque la
 * réplica puede no estar activada aún. Deny-by-default: si un catálogo no
 * existe, no hay permisos o la consulta falla, se reporta 'sin_configurar'
 * o se omite el conteo — jamás el error crudo ni detalles de conexión.
 *
 * Los `count(*)::int` cuestan lo mismo que `count(*)` y evitan `bigint`
 * (no serializable en JSON) en la respuesta.
 */
async function saludReplica(db: EstadoDb): Promise<SaludReplica> {
    // Sin BD no hay réplica que sondear: no se repite el sondeo fallido.
    if (db === "no_configurada") return { estado: "sin_configurar" };
    if (db === "error") return { estado: "error" };

    // Suscripción de réplica lógica en esta BD (lado suscriptor). Si el
    // catálogo no existe, no hay permisos o la consulta falla, la réplica
    // no está activada → 'sin_configurar' (no se inventa disponibilidad).
    let suscripciones = 0;
    try {
        const filas = await prisma.$queryRaw<{ total: number }[]>`
            SELECT count(*)::int AS total FROM pg_stat_subscription`;
        suscripciones = filas[0]?.total ?? 0;
    } catch {
        return { estado: "sin_configurar" };
    }
    if (suscripciones === 0) return { estado: "sin_configurar" };

    const salud: SaludReplica = { estado: "activa" };

    // Tablas ya sincronizadas con la publicación (srsubstate 'r'). Si este
    // sondeo falla se reporta solo el estado, sin el conteo.
    try {
        const filas = await prisma.$queryRaw<{ total: number }[]>`
            SELECT count(*)::int AS total
              FROM pg_stat_subscription_rel
             WHERE srsubstate = 'r'`;
        salud.tablasReplicando = filas[0]?.total ?? 0;
    } catch {
        // Omite tablasReplicando: queda estado 'activa' sin detalle.
    }

    // MVs del BI: pobladas vs totales. Si falla se omiten ambos campos.
    try {
        const filas = await prisma.$queryRaw<{ total: number; pobladas: number }[]>`
            SELECT count(*)::int AS total,
                   count(*) FILTER (WHERE ispopulated)::int AS pobladas
              FROM pg_matviews
             WHERE matviewname LIKE 'mv_fact_%'`;
        salud.mvTotales = filas[0]?.total ?? 0;
        salud.mvPobladas = filas[0]?.pobladas ?? 0;
    } catch {
        // Omite mvPobladas/mvTotales.
    }

    return salud;
}

/**
 * Healthcheck público mínimo para Docker (D1) — sin datos sensibles: la
 * sección `replica` expone solo un estado categórico y conteos agregados.
 * Responde SIEMPRE 200: reporta el estado en el cuerpo, no en el código HTTP.
 */
export async function GET() {
    const db = await estadoDb();
    const replica = await saludReplica(db);
    return NextResponse.json({
        ok: true,
        servicio: "bi-006",
        fase: "2-motor-nl-sql",
        hora: new Date().toISOString(),
        db,
        replica,
    });
}
