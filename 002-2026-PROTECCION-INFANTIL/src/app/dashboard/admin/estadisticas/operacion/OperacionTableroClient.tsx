"use client";

/**
 * SPEC-171 (Pilar B) — Tablero operativo.
 * Tab "Operación": 6 semáforos de infraestructura + widgets (cola, atascados,
 * errores, SLA) encima del dashboard de métricas de negocio. Autorefresco con
 * `autorefreshSeg` del endpoint de estado (default 30 s); si el vigilante está
 * desactivado (`monitoreoEnabled: false`) se muestra un banner y no hay
 * autorefresco. Tablero de solo lectura: cero acciones destructivas.
 * Tab "Clasificación": el tablero de la antigua ruta .../clasificacion.
 */
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminDashboard } from "@/components/modules/AdminDashboard";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";
import { SemaforoCard, SENALES_OPERACION, type EstadoSemaforo } from "@/components/modules/monitoreo/SemaforoCard";
import { WidgetAtascados } from "@/components/modules/monitoreo/WidgetAtascados";
import { WidgetCola } from "@/components/modules/monitoreo/WidgetCola";
import { WidgetErrores } from "@/components/modules/monitoreo/WidgetErrores";
import { WidgetSla } from "@/components/modules/monitoreo/WidgetSla";
import { OllamaSmokeHistorial } from "@/components/modules/monitoreo/OllamaSmokeHistorial";
import { ClasificacionTab } from "./ClasificacionTab";
import { LogsTab } from "@/components/modules/monitoreo/LogsTab";
import { ColegiosAnalyticsTable } from "@/components/modules/admin/ColegiosAnalyticsTable";

type SenalEstado = {
    estado: EstadoSemaforo;
    ultimoProbeEn: string | null;
    detalle?: string | null;
};

type EstadoMonitoreo = {
    senales: Record<string, SenalEstado>;
    autorefreshSeg?: number;
    monitoreoEnabled?: boolean;
};

type TabKey = "operacion" | "clasificacion" | "logs" | "colegios";

function tabDesdeQuery(raw: string | null): TabKey {
    if (raw === "clasificacion") return "clasificacion";
    if (raw === "logs") return "logs";
    if (raw === "colegios") return "colegios";
    return "operacion";
}

export function OperacionTableroClient() {
    const searchParams = useSearchParams();
    // SPEC-180: la navegación entre secciones vive en EstadisticasSubNav (nivel
    // página); este componente solo LEE el tab de la URL (sin nav interno — la
    // doble fila de tabs fue el hallazgo I-59 del CEO en prod).
    const tab: TabKey = tabDesdeQuery(searchParams.get("tab"));

    const [estado, setEstado] = useState<EstadoMonitoreo | null>(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Recargo compartido: los widgets repiden su endpoint en cada tick del autorefresco.
    const [tick, setTick] = useState(0);
    // SPEC-186: historial de probes Ollama.
    const [historialAbierto, setHistorialAbierto] = useState(false);

    const cargarEstado = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/monitoreo/estado", { credentials: "include" });
            const data: unknown = await res.json().catch(() => null);
            if (!res.ok) {
                const mensaje =
                    data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : undefined;
                setError(mensaje || "No se pudo consultar el estado del monitoreo.");
                return;
            }
            setEstado(data as EstadoMonitoreo);
            setError(null);
        } catch {
            setError("Error de red al consultar el estado del monitoreo.");
        } finally {
            setCargando(false);
        }
    }, []);

    useEffect(() => {
        if (tab !== "operacion") return;
        void cargarEstado();
    }, [cargarEstado, tab]);

    const monitoreoEnabled = estado?.monitoreoEnabled !== false;
    const autorefreshSeg =
        estado?.autorefreshSeg && estado.autorefreshSeg > 0 ? estado.autorefreshSeg : 30;

    useEffect(() => {
        if (tab !== "operacion" || !monitoreoEnabled) return;
        const id = setInterval(() => {
            void cargarEstado();
            setTick((t) => t + 1);
        }, autorefreshSeg * 1000);
        return () => clearInterval(id);
    }, [cargarEstado, autorefreshSeg, monitoreoEnabled, tab]);

    return (
        <div className="space-y-6">
            {tab === "clasificacion" && <ClasificacionTab />}
            {tab === "logs" && <LogsTab />}
            {tab === "colegios" && <ColegiosAnalyticsTable />}
            {tab === "operacion" && (
                <div className="space-y-8">
                    {cargando && !estado ? (
                        <Cargando texto="Consultando el vigilante..." />
                    ) : error && !estado ? (
                        <ErrorState
                            title="No pudimos consultar el monitoreo"
                            description={error}
                            onRetry={() => void cargarEstado()}
                        />
                    ) : (
                        <>
                            {!monitoreoEnabled && (
                                <div
                                    role="status"
                                    className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
                                >
                                    Monitoreo desactivado: el vigilante está apagado en Configuración. Los semáforos muestran el último estado conocido y el tablero no se actualiza solo.
                                </div>
                            )}

                            <section className="space-y-4" aria-labelledby="semaforos-title">
                                <h2 id="semaforos-title" className="text-lg font-semibold text-body">Salud del sistema</h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                                    {SENALES_OPERACION.map((senal) => {
                                        const datosSenal = estado?.senales?.[senal.clave];
                                        return (
                                            <SemaforoCard
                                                key={senal.clave}
                                                nombre={senal.nombre}
                                                estado={datosSenal?.estado ?? "amarillo"}
                                                ultimoProbeEn={datosSenal?.ultimoProbeEn ?? null}
                                                hint={senal.hint}
                                                onClick={senal.clave === "ollama_ping" ? () => setHistorialAbierto(true) : undefined}
                                            />
                                        );
                                    })}
                                </div>
                            </section>

                            <section className="space-y-4" aria-labelledby="widgets-title">
                                <h2 id="widgets-title" className="text-lg font-semibold text-body">Operación en curso</h2>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <WidgetCola recargaId={tick} />
                                    <WidgetAtascados recargaId={tick} />
                                    <WidgetErrores recargaId={tick} />
                                    <WidgetSla recargaId={tick} />
                                </div>
                            </section>
                        </>
                    )}

                    <AdminDashboard />
                    <OllamaSmokeHistorial abierto={historialAbierto} onCerrar={() => setHistorialAbierto(false)} />
                </div>
            )}
        </div>
    );
}
