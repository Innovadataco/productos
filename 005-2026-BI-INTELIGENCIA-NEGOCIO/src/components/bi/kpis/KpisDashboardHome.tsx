"use client";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/ui/ErrorState";

type ValorKpi = { valor: number | null; nota?: string };
type Uptime = { ok: boolean; latMs: number | null; error?: string };

interface KpisResponse {
    generadoEn: string;
    kpis: {
        reportes24h: ValorKpi;
        alertasActivas: ValorKpi;
        colegiosActivos: ValorKpi;
        suscActivas: ValorKpi;
        mrrMesActualCop: ValorKpi;
        uptime: { biNext: Uptime; biVanna: Uptime; piApp: Uptime };
    };
}

function formatInt(v: number | null): string {
    if (v === null) return "sin datos aún";
    return new Intl.NumberFormat("es-CO").format(v);
}

function formatCop(v: number | null): string {
    if (v === null) return "sin datos aún";
    return new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(v);
}

function KpiCard({
    title,
    value,
    format,
}: {
    title: string;
    value: number | null;
    format: "int" | "cop";
}) {
    const isEmpty = value === null;
    const display = format === "cop" ? formatCop(value) : formatInt(value);
    return (
        <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            data-testid={`kpi-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
        >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {title}
            </p>
            <p
                className={
                    isEmpty
                        ? "mt-2 text-xl font-medium text-slate-400"
                        : "mt-2 text-3xl font-bold text-slate-900"
                }
            >
                {display}
            </p>
        </div>
    );
}

function UptimeCard({
    uptime,
}: {
    uptime: KpisResponse["kpis"]["uptime"];
}) {
    const svc: { key: keyof typeof uptime; label: string }[] = [
        { key: "biNext", label: "bi-next" },
        { key: "biVanna", label: "bi-vanna" },
        { key: "piApp", label: "pi-app" },
    ];
    return (
        <div
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
            data-testid="kpi-uptime"
        >
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Uptime servicios
            </p>
            <div className="mt-3 space-y-2">
                {svc.map(({ key, label }) => {
                    const u = uptime[key];
                    const clase = u.ok
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800";
                    const texto = u.ok
                        ? u.latMs === 0
                            ? "ok"
                            : `ok · ${u.latMs} ms`
                        : u.error ?? "error";
                    return (
                        <div
                            key={key}
                            className="flex items-center justify-between text-sm"
                            data-testid={`uptime-${key}`}
                        >
                            <span className="font-medium text-slate-700">
                                {label}
                            </span>
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs ${clase}`}
                            >
                                {texto}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export function KpisDashboardHome() {
    const [data, setData] = useState<KpisResponse | null>(null);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/bi/kpis", { credentials: "include" })
            .then((r) =>
                r.ok
                    ? (r.json() as Promise<KpisResponse>)
                    : Promise.reject(new Error(String(r.status))),
            )
            .then(setData)
            .catch((e: Error) => setErr(e.message));
    }, []);

    if (err) {
        return (
            <ErrorState
                title="No se pudieron cargar los KPIs"
                description={err}
            />
        );
    }
    if (!data) {
        return (
            <div
                className="animate-pulse text-sm text-slate-500"
                data-testid="kpis-loading"
            >
                Cargando KPIs…
            </div>
        );
    }

    const k = data.kpis;
    return (
        <div
            className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
            data-testid="kpis-grid"
        >
            <KpiCard
                title="Reportes últimas 24 h"
                value={k.reportes24h.valor}
                format="int"
            />
            <KpiCard
                title="Alertas activas (7 d)"
                value={k.alertasActivas.valor}
                format="int"
            />
            <KpiCard
                title="Colegios activos"
                value={k.colegiosActivos.valor}
                format="int"
            />
            <KpiCard
                title="Suscripciones activas"
                value={k.suscActivas.valor}
                format="int"
            />
            <KpiCard
                title="MRR mes actual (COP)"
                value={k.mrrMesActualCop.valor}
                format="cop"
            />
            <UptimeCard uptime={k.uptime} />
        </div>
    );
}
