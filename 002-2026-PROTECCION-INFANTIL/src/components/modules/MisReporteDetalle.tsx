"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
    /** SPEC-591: ficha a la que va dirigido (null si no aplica). */
    hijoNombre?: string | null;
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
            return base + "bg-ambar/10 text-estado-ambar";
        case "success":
            return base + "bg-pino/10 text-estado-pino";
        case "muted":
        default:
            return base + "bg-tinta/5 text-muted";
    }
}

// SPEC-593: el reporte se procesa en segundo plano (cola + worker). Mientras el
// estado sea pendiente/procesando, esta vista lo refresca sola cada 15 s y corta
// al llegar a un estado final, así el padre no tiene que salir y volver a entrar.
const INTERVALO_POLLING_MS = 15_000;

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
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Espejo de `data` para consultas dentro de callbacks sin re-crearlos
    // (un fallo de polling solo setea error cuando aún no hay nada en pantalla).
    const dataRef = useRef<DetalleResponse | null>(null);
    // push vive en un ref para que `cargar` sea estable entre renders: si
    // dependiera del objeto router, cada render lo re-crearía y el efecto de
    // carga (y el polling) se re-dispararían en cadena.
    const pushRef = useRef<(href: string) => void>(() => {});
    useEffect(() => {
        pushRef.current = router.push;
    }, [router]);

    const cargar = useCallback(async () => {
        try {
            const res = await fetch(`/api/reportes/mis-reportes/${encodeURIComponent(reporteId)}`, {
                credentials: "include",
            });
            if (res.status === 401) {
                pushRef.current("/login");
                return;
            }
            if (res.status === 403) throw new Error("Este reporte pertenece a otro usuario.");
            if (res.status === 404) throw new Error("No encontramos este reporte.");
            if (!res.ok) throw new Error("Error al cargar el detalle del reporte");
            const json = (await res.json()) as DetalleResponse;
            dataRef.current = json;
            setError("");
            setData(json);
        } catch (err) {
            // Un fallo de refresco (polling) no borra lo que ya se está mostrando:
            // solo surfaceamos error cuando aún no hay datos.
            if (dataRef.current === null) {
                setError(err instanceof Error ? err.message : "Error");
            }
        }
    }, [reporteId]);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    // SPEC-593: polling ligero SOLO mientras el reporte está en procesamiento;
    // al llegar a estado final (enProceso false) se corta el interval. La
    // limpieza garantiza que no haya setState ni fetches tras el desmontaje.
    useEffect(() => {
        if (data?.reporte.enProceso) {
            timerRef.current = setInterval(() => void cargar(), INTERVALO_POLLING_MS);
            return () => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
            };
        }
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
        return undefined;
    }, [data?.reporte.enProceso, cargar]);

    // El estado de carga es derivado: mientras no hay datos ni error, cargamos.
    const loading = data === null && error === "";

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
                        {reporte.hijoNombre ? (
                            <p className="mt-0.5 text-xs text-subtle">Dirigido a {reporte.hijoNombre}</p>
                        ) : null}
                    </div>
                    <span className={estadoBadgeClass(reporte.badge)}>{reporte.estadoVisual}</span>
                </div>
                {clasificacion && clasificacion.conductas.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-muted">Conductas identificadas:</span>
                        {clasificacion.conductas.map((c) => (
                            <span
                                key={c.categoria}
                                className="rounded-full bg-cielo/10 px-2 py-0.5 text-xs font-medium text-estado-cielo"
                            >
                                {c.label}
                            </span>
                        ))}
                    </div>
                )}
            </GlassCard>

            {!clasificacion ? (
                <GlassCard className="p-6" aria-live="polite">
                    {reporte.enProceso ? (
                        <>
                            <p className="flex items-center gap-2 text-sm font-medium text-body">
                                <span aria-hidden="true" className="inline-block h-2 w-2 animate-pulse rounded-full bg-ambar" />
                                Estamos procesando tu reporte
                            </p>
                            <p className="mt-2 text-sm text-muted">
                                La revisión está en curso y esta pantalla se actualiza sola — no necesitas salir y volver
                                a entrar. Cuando termine, aquí verás qué conductas se identificaron y qué puedes hacer.
                            </p>
                        </>
                    ) : (
                        <p className="text-sm text-muted">
                            Tu reporte aún está en proceso. Cuando termine la revisión, aquí verás qué conductas se
                            identificaron y qué puedes hacer.
                        </p>
                    )}
                </GlassCard>
            ) : (
                <GlassCard className="p-6">
                    <h3 className="text-lg font-semibold text-body">Qué significa esto</h3>
                    <p className="mt-2 text-sm text-muted whitespace-pre-line">{clasificacion.mensaje}</p>
                </GlassCard>
            )}

            {/* SPEC-610 (I-372 · D-123): el pase se genera DESDE EL EXPEDIENTE, no
                desde la pantalla vieja de «Mis reportes». Dejarlo acá creaba dos
                formas de compartir con alcances distintos (un relato vs el caso) —
                la confusión que D-129 (llave/pase) deshizo. El generador vive ahora
                en el expediente; esta pantalla ya no comparte. */}
            <CanalesOficiales />
        </div>
    );
}
