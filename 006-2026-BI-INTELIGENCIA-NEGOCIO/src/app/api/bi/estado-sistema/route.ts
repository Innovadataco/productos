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
    /** Apply worker de la suscripción con proceso vivo (pg_stat_subscription) */
    workerVivo?: boolean;
    /** Minutos desde el último mensaje aplicado; null = nunca llegó uno */
    minDesdeUltimoMensaje?: number | null;
    tablasReplicando?: number;
    mvPobladas?: number;
    mvTotales?: number;
};

// Timeout corto: es un healthcheck, no debe colgar el contenedor (D1).
const TIMEOUT_DB_MS = 2500;

// I-390 (2026-09-11): la réplica estuvo caída 3 días con subenabled='t' —
// el apply worker moría en bucle y el conteo de suscripciones no lo notaba.
// 'activa' exige worker vivo y lag razonable; la línea de defensa completa
// es scripts/vigia-replica.sh (cron del VPS · alertas en bi_audit_log).
const LAG_MAX_MIN = 15; // PI escribe continuamente (worker_logs/AuditLog)

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

    // Worker vivo y frescura del último mensaje aplicado. Estos DOS campos
    // son los que faltaban el 08-09: la suscripción existía y el conteo daba
    // 'activa' mientras el apply worker reiniciaba en bucle cada 5 s.
    let workerVivo: boolean | undefined;
    let minDesdeUltimoMensaje: number | null | undefined;
    try {
        const filas = await prisma.$queryRaw<{ vivo: boolean; lag: number | null }[]>`
            SELECT pid IS NOT NULL AS vivo,
                   round(EXTRACT(EPOCH FROM (now() - last_msg_receipt_time))/60)::int AS lag
              FROM pg_stat_subscription
             WHERE subname = 'bi006_replica_sub'`;
        const fila = filas[0];
        workerVivo = fila?.vivo;
        minDesdeUltimoMensaje = fila?.lag ?? null;
    } catch {
        // Omite ambos campos: queda el criterio previo (conteo de tablas).
    }

    // 'activa' con worker muerto o mensajes estancados es exactamente el
    // cero falso de I-390: se reporta 'error' aunque subenabled diga lo
    // contrario. undefined = sondeo fallido (no se condena por lo no
    // medido, candado 9); null = lag medido que nunca existió → réplica
    // que jamás aplicó un mensaje: también error.
    // undefined (sondeo fallido, candado 9) y null (lag medido que nunca
    // existió: réplica que jamás aplicó un mensaje) se tratan distinto:
    // el primero perdona, el segundo condena.
    const lagSano =
        minDesdeUltimoMensaje === undefined ||
        (minDesdeUltimoMensaje !== null && minDesdeUltimoMensaje < LAG_MAX_MIN);
    const sana = workerVivo !== false && lagSano;
    const salud: SaludReplica = {
        estado: sana ? "activa" : "error",
        workerVivo,
        minDesdeUltimoMensaje,
    };

    // Tablas ya sincronizadas con la publicación (srsubstate 'r'). Si este
    // sondeo falla se reporta solo el estado, sin el conteo.
    // OJO: la vista es pg_subscription_rel (catálogo); "pg_stat_subscription_rel"
    // NO existe — con el nombre erróneo este campo jamás se poblaría.
    try {
        const filas = await prisma.$queryRaw<{ total: number }[]>`
            SELECT count(*)::int AS total
              FROM pg_subscription_rel
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
