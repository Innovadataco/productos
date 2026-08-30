import { NextResponse } from "next/server";
import { sesionDeRequest } from "@/lib/auth/sesion";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type ValorKpi = { valor: number | null; nota?: string };
type Uptime = { ok: boolean; latMs: number | null; error?: string };

async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
        return await fn();
    } catch {
        return fallback;
    }
}

async function fetchHealth(url: string, timeoutMs = 3000): Promise<Uptime> {
    const t0 = performance.now();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
        const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
        return { ok: r.ok, latMs: Math.round(performance.now() - t0) };
    } catch (e) {
        return {
            ok: false,
            latMs: null,
            error: e instanceof Error ? e.message : "error",
        };
    } finally {
        clearTimeout(to);
    }
}

function toNum(rows: { v: bigint | number | null }[]): number | null {
    const v = rows[0]?.v;
    if (v === null || v === undefined) return null;
    const n = typeof v === "bigint" ? Number(v) : v;
    // candado 9: si 0 filas (SUM devuelve 0 por COALESCE) o count 0 → "sin datos"
    return n === 0 ? null : n;
}

const VANNA_URL = process.env.VANNA_API_URL ?? "http://bi-vanna:8001";
const PI_URL = process.env.PI_BASE_URL ?? "https://pi.innovadataco.com";

export async function GET(req: Request): Promise<NextResponse> {
    const sesion = await sesionDeRequest(req);
    if (!sesion) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    type Row = { v: bigint | number | null };

    const [
        reportes24h,
        alertasActivas,
        colegiosActivos,
        suscActivas,
        mrrMes,
        upBiVanna,
        upPiApp,
    ] = await Promise.all([
        safeQuery(
            () =>
                prisma.$queryRaw<Row[]>`
                    SELECT COALESCE(SUM(total_reportes), 0)::bigint AS v
                    FROM mv_fact_reporte_diario
                    WHERE dia >= NOW() - INTERVAL '24 hours'
                `,
            [{ v: null }] as Row[],
        ),
        safeQuery(
            () =>
                prisma.$queryRaw<Row[]>`
                    SELECT COALESCE(SUM(total_alertas_colegio + total_alertas_suscripcion), 0)::bigint AS v
                    FROM mv_fact_salud_sistema
                    WHERE dia >= (NOW() AT TIME ZONE 'America/Bogota')::date - 7
                `,
            [{ v: null }] as Row[],
        ),
        safeQuery(
            () =>
                prisma.$queryRaw<Row[]>`
                    SELECT count(*)::bigint AS v FROM "Colegio" WHERE estado = 'activo'
                `,
            [{ v: null }] as Row[],
        ),
        safeQuery(
            () =>
                prisma.$queryRaw<Row[]>`
                    SELECT count(*)::bigint AS v FROM "Subscription" WHERE estado = 'activo'
                `,
            [{ v: null }] as Row[],
        ),
        safeQuery(
            () =>
                prisma.$queryRaw<Row[]>`
                    SELECT COALESCE(SUM(monto_total), 0)::float8 AS v
                    FROM mv_fact_comercial_mensual
                    WHERE mes = date_trunc('month', NOW() AT TIME ZONE 'America/Bogota')
                      AND ciclo_estado = 'pagado'
                `,
            [{ v: null }] as Row[],
        ),
        fetchHealth(`${VANNA_URL}/health`),
        fetchHealth(`${PI_URL}/api/health`),
    ]);

    const body = {
        generadoEn: new Date().toISOString(),
        kpis: {
            reportes24h: { valor: toNum(reportes24h) } as ValorKpi,
            alertasActivas: { valor: toNum(alertasActivas) } as ValorKpi,
            colegiosActivos: { valor: toNum(colegiosActivos) } as ValorKpi,
            suscActivas: { valor: toNum(suscActivas) } as ValorKpi,
            mrrMesActualCop: { valor: toNum(mrrMes) } as ValorKpi,
            uptime: {
                biNext: { ok: true, latMs: 0 } as Uptime,
                biVanna: upBiVanna,
                piApp: upPiApp,
            },
        },
    };

    return NextResponse.json(body, {
        headers: { "Cache-Control": "no-store" },
    });
}
