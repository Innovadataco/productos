"use client";
import { useEffect, useState } from "react";
import type { EstadoSistema, EstadoServicio, UltimoReporte } from "@/app/api/bi/estado-sistema/route";

/**
 * SPEC-027 · widget que consume GET /api/bi/estado-sistema y renderiza
 * 3 pastillas de servicio + 1 card con el último BIConsultaLog. Nunca
 * rompe la página: skeleton mientras carga, mensaje seco si el fetch
 * falla completo.
 */

interface Props {
    endpointUrl?: string;
    className?: string;
}

type EstadoUI = "cargando" | "listo" | "error";

function tiempoRelativo(iso: string): string {
    const d = new Date(iso).getTime();
    const ahora = Date.now();
    const seg = Math.max(0, Math.floor((ahora - d) / 1000));
    if (seg < 60) return `hace ${seg}s`;
    const min = Math.floor(seg / 60);
    if (min < 60) return `hace ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `hace ${h} h`;
    const dias = Math.floor(h / 24);
    return `hace ${dias} día${dias === 1 ? "" : "s"}`;
}

function PastillaServicio({ label, servicio }: { label: string; servicio: EstadoServicio }) {
    const ok = servicio.ok;
    const color = ok ? "bg-emerald-100 text-emerald-900 border-emerald-300" : "bg-red-100 text-red-900 border-red-300";
    const badge = ok ? "🟢" : "🔴";
    return (
        <div
            data-testid={`pastilla-${label.toLowerCase()}`}
            data-ok={String(ok)}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${color}`}
        >
            <span aria-hidden="true">{badge}</span>
            <div className="flex-1">
                <div className="font-medium">{label}</div>
                <div className="text-xs opacity-80">
                    {ok
                        ? servicio.latenciaMs != null
                            ? `OK · ${servicio.latenciaMs} ms`
                            : "OK"
                        : servicio.error || "no disponible"}
                </div>
            </div>
        </div>
    );
}

function CardUltimoReporte({ reporte, error }: { reporte: UltimoReporte | null; error?: string }) {
    if (error) {
        return (
            <div data-testid="card-ultimo-reporte" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                <div className="font-medium text-amber-900">Último reporte</div>
                <div className="text-xs text-amber-800">consulta a BD falló: {error.slice(0, 80)}</div>
            </div>
        );
    }
    if (!reporte) {
        return (
            <div data-testid="card-ultimo-reporte" className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                <div className="font-medium">Último reporte</div>
                <div className="text-xs text-slate-500">sin datos aún</div>
            </div>
        );
    }
    return (
        <div data-testid="card-ultimo-reporte" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
            <div className="font-medium text-slate-900">Último reporte</div>
            <div className="text-xs text-slate-600">
                {tiempoRelativo(reporte.creadoEn)} · <code>{reporte.estado}</code>
                {reporte.latenciaMs != null ? ` · ${reporte.latenciaMs} ms` : ""}
            </div>
        </div>
    );
}

function Skeleton() {
    return (
        <div data-testid="estado-skeleton" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100" />
            ))}
        </div>
    );
}

export function EstadoSistemaWidget({ endpointUrl = "/api/bi/estado-sistema", className = "" }: Props) {
    const [estado, setEstado] = useState<EstadoUI>("cargando");
    const [data, setData] = useState<EstadoSistema | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        let cancelado = false;
        fetch(endpointUrl)
            .then(async (res) => {
                if (!res.ok) throw new Error(`http_${res.status}`);
                return (await res.json()) as EstadoSistema;
            })
            .then((body) => {
                if (cancelado) return;
                setData(body);
                setEstado("listo");
            })
            .catch((e: unknown) => {
                if (cancelado) return;
                setErrorMsg(e instanceof Error ? e.message : "error_red");
                setEstado("error");
            });
        return () => {
            cancelado = true;
        };
    }, [endpointUrl]);

    const wrapper = `space-y-3 ${className}`.trim();

    if (estado === "cargando") {
        return (
            <section aria-label="Estado del sistema" className={wrapper}>
                <Skeleton />
            </section>
        );
    }
    if (estado === "error" || !data) {
        return (
            <section aria-label="Estado del sistema" className={wrapper}>
                <div data-testid="estado-error" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
                    No se pudo consultar el estado del sistema: {errorMsg || "desconocido"}
                </div>
            </section>
        );
    }

    return (
        <section aria-label="Estado del sistema" data-testid="estado-sistema" className={wrapper}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PastillaServicio label="Vanna" servicio={data.vanna} />
                <PastillaServicio label="Superset" servicio={data.superset} />
                <PastillaServicio label="PI" servicio={data.pi} />
                <CardUltimoReporte reporte={data.ultimoReporte} error={data.ultimoReporteError} />
            </div>
        </section>
    );
}
