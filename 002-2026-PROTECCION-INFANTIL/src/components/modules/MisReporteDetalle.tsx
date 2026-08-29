"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";

type BadgeVisual = "warning" | "success" | "muted";

interface DetalleReporte {
    id: string;
    identificador: string;
    plataforma: string;
    ciudad: string;
    pais: string;
    creadoEn: string;
    estadoVisual: string;
    badge: BadgeVisual;
    enProceso: boolean;
}

interface ConductaConfirmada {
    categoria: string;
    label: string;
}

interface DetalleResponse {
    reporte: DetalleReporte;
    clasificacion: {
        conductas: ConductaConfirmada[];
        mensaje: string;
    } | null;
}

function estadoBadgeClass(badge: BadgeVisual): string {
    const base = "rounded-full px-3 py-1 text-xs font-medium ";
    switch (badge) {
        case "warning":
            return base + "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300";
        case "success":
            return base + "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
        case "muted":
        default:
            return base + "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400";
    }
}

/**
 * Detalle PRIVADO de un reporte del usuario (spec 090 US3; vista rehecha en
 * spec 116). El padre ve SOLO tres cosas: qué conductas se identificaron
 * (SOLO las confirmadas por el motor; ninguna descartada), qué significan
 * (mensaje de plantilla determinista, D-23) y qué puede hacer (canales
 * oficiales). La traza técnica del motor (modelos, votos, porcentajes,
 * umbrales) es superficie del admin (D-22) y vive en el expediente (spec 096).
 */
export function MisReporteDetalle({ reporteId }: { reporteId: string }) {
    const router = useRouter();
    const [data, setData] = useState<DetalleResponse | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        setError("");
        fetch(`/api/reportes/mis-reportes/${encodeURIComponent(reporteId)}`, { credentials: "include" })
            .then(async (res) => {
                if (res.status === 401) {
                    router.push("/login");
                    return;
                }
                if (res.status === 403) throw new Error("Este reporte pertenece a otro usuario.");
                if (res.status === 404) throw new Error("No encontramos este reporte.");
                if (!res.ok) throw new Error("Error al cargar el detalle del reporte");
                setData(await res.json());
            })
            .catch((err) => setError(err instanceof Error ? err.message : "Error"))
            .finally(() => setLoading(false));
    }, [reporteId, router]);

    if (loading) {
        return (
            <div className="glass rounded-2xl p-8 text-center animate-pulse">
                <Cargando texto="Cargando detalle..." />
            </div>
        );
    }

    if (error || !data) {
        return (
            <ErrorState
                title="No pudimos cargar el detalle"
                description={error || "Ocurrió un problema al consultar la información."}
                onRetry={() => window.location.reload()}
            />
        );
    }

    const { reporte, clasificacion } = data;

    return (
        <div className="space-y-6">
            <div>
                <Link href="/mis-reportes" className="text-sm text-accent hover:underline">
                    ← Volver a mis reportes
                </Link>
                <h1 className="mt-2 text-2xl font-bold text-body">Detalle del reporte</h1>
            </div>

            <GlassCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="font-semibold text-body truncate">{reporte.identificador}</h2>
                        <p className="text-sm text-muted">
                            {reporte.plataforma} · {reporte.ciudad}, {reporte.pais}
                        </p>
                        <p className="mt-0.5 text-xs text-subtle">
                            Reportado el {new Date(reporte.creadoEn).toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}
                        </p>
                    </div>
                    <span className={estadoBadgeClass(reporte.badge)}>{reporte.estadoVisual}</span>
                </div>
                {clasificacion && clasificacion.conductas.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">Conductas identificadas:</span>
                        {clasificacion.conductas.map((c) => (
                            <span
                                key={c.categoria}
                                className="rounded-full bg-sky-50 dark:bg-sky-950/40 px-2 py-0.5 text-xs font-medium text-accent"
                            >
                                {c.label}
                            </span>
                        ))}
                    </div>
                )}
            </GlassCard>

            {!clasificacion ? (
                <GlassCard className="p-6">
                    <p className="text-sm text-muted">
                        Tu reporte aún está en proceso. Cuando termine la revisión, aquí verás qué conductas se
                        identificaron y qué puedes hacer.
                    </p>
                </GlassCard>
            ) : (
                <GlassCard className="p-6">
                    <h3 className="text-lg font-semibold text-body">Qué significa esto</h3>
                    <p className="mt-2 text-sm text-muted whitespace-pre-line">{clasificacion.mensaje}</p>
                </GlassCard>
            )}

            <CanalesOficiales />
        </div>
    );
}
