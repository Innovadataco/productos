import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * SPEC-027 · GET /api/bi/estado-sistema
 * Agregador de healthchecks (bi-vanna · bi-superset · pi-app) + timestamp
 * del último BIConsultaLog. Candado 9: cada chequeo aislado con
 * Promise.allSettled + timeout individual; un servicio caído NO tumba
 * los otros. Responde 200 siempre salvo error catastrófico del runtime.
 */

const TIMEOUT_MS = 3000;

export interface EstadoServicio {
    ok: boolean;
    latenciaMs?: number;
    error?: string;
    detalle?: Record<string, unknown>;
}

export interface UltimoReporte {
    id: string;
    estado: string;
    creadoEn: string;
    latenciaMs: number | null;
}

export interface EstadoSistema {
    vanna: EstadoServicio;
    superset: EstadoServicio;
    pi: EstadoServicio;
    ultimoReporte: UltimoReporte | null;
    ultimoReporteError?: string;
    tsGeneradoEn: string;
}

async function fetchOk(url: string): Promise<EstadoServicio> {
    const t0 = Date.now();
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const latenciaMs = Date.now() - t0;
        if (!res.ok) {
            return { ok: false, latenciaMs, error: `http_${res.status}` };
        }
        let detalle: Record<string, unknown> | undefined;
        try {
            detalle = (await res.json()) as Record<string, unknown>;
        } catch {
            // servicio devolvió texto plano o vacío · lo tratamos como OK igual
        }
        return { ok: true, latenciaMs, detalle };
    } catch (e) {
        const latenciaMs = Date.now() - t0;
        const msg = e instanceof Error ? e.message : "unknown";
        return {
            ok: false,
            latenciaMs,
            error: msg.includes("aborted") || msg.includes("timeout")
                ? "timeout"
                : "no_disponible",
            detalle: { raw: msg.slice(0, 200) },
        };
    }
}

async function ultimoReporteBD(): Promise<{ ultimoReporte: UltimoReporte | null; ultimoReporteError?: string }> {
    try {
        const r = await prisma.bIConsultaLog.findFirst({
            orderBy: { creadoEn: "desc" },
            select: { id: true, estado: true, creadoEn: true, latenciaMs: true },
        });
        if (!r) return { ultimoReporte: null };
        return {
            ultimoReporte: {
                id: r.id,
                estado: r.estado,
                creadoEn: r.creadoEn.toISOString(),
                latenciaMs: r.latenciaMs,
            },
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : "prisma_error";
        return { ultimoReporte: null, ultimoReporteError: msg.slice(0, 200) };
    }
}

export async function GET() {
    const vannaUrl = (process.env.VANNA_BASE_URL || "http://bi-vanna:8001") + "/health";
    const supersetUrl = (process.env.SUPERSET_INTERNAL_URL || "http://bi-superset:8088") + "/health";
    const piUrl = (process.env.PI_BASE_URL || "https://pi.innovadataco.com") + "/api/health";

    const [vannaR, supersetR, piR, bdR] = await Promise.allSettled([
        fetchOk(vannaUrl),
        fetchOk(supersetUrl),
        fetchOk(piUrl),
        ultimoReporteBD(),
    ]);

    const settledToServicio = (r: PromiseSettledResult<EstadoServicio>): EstadoServicio =>
        r.status === "fulfilled"
            ? r.value
            : { ok: false, error: "chequeo_fallo", detalle: { raw: String(r.reason).slice(0, 200) } };

    const settledToBD = (r: PromiseSettledResult<{ ultimoReporte: UltimoReporte | null; ultimoReporteError?: string }>) =>
        r.status === "fulfilled"
            ? r.value
            : { ultimoReporte: null, ultimoReporteError: String(r.reason).slice(0, 200) };

    const bd = settledToBD(bdR);
    const cuerpo: EstadoSistema = {
        vanna: settledToServicio(vannaR),
        superset: settledToServicio(supersetR),
        pi: settledToServicio(piR),
        ultimoReporte: bd.ultimoReporte,
        ultimoReporteError: bd.ultimoReporteError,
        tsGeneradoEn: new Date().toISOString(),
    };
    return NextResponse.json(cuerpo, { status: 200 });
}
