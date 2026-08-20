"use client";

/**
 * SPEC-186 (002-PI-081) — Modal/subsección con historial de probes Ollama.
 * Muestra el resumen de las últimas 24h y una tabla con los últimos 50 chequeos.
 */
import { useEffect, useState } from "react";
import { Cargando } from "@/components/ui/Cargando";
import { ErrorState } from "@/components/ui/ErrorState";

type ProbeHistorial = {
    id: string;
    senal: string;
    ok: boolean;
    latenciaMs: number;
    detalle: string | null;
    metodo: string | null;
    creadoEn: string;
};

type Resumen24h = {
    pings: number;
    piggybacks: number;
    smokes: number;
    fallos: number;
};

function etiquetaMetodo(metodo: string | null): string {
    switch (metodo) {
        case "PING": return "Ping";
        case "PIGGYBACK": return "Piggyback";
        case "SMOKE": return "Smoke real";
        default: return "Desconocido";
    }
}

function claseBadge(ok: boolean): string {
    return ok
        ? "bg-pino/10 text-pino dark:bg-pino/20"
        : "bg-rubi/10 text-rubi dark:bg-rubi/20";
}

export function OllamaSmokeHistorial({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
    const [items, setItems] = useState<ProbeHistorial[]>([]);
    const [resumen, setResumen] = useState<Resumen24h | null>(null);
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!abierto) return;
        setCargando(true);
        setError(null);
        fetch("/api/admin/monitoreo/historial?senal=ollama_smoke&limite=50", { credentials: "include" })
            .then(async (res) => {
                const data: unknown = await res.json().catch(() => null);
                if (!res.ok) {
                    const mensaje = data && typeof data === "object" && "error" in data
                        ? (data as { error?: { message?: string } }).error?.message
                        : "No se pudo cargar el historial";
                    throw new Error(mensaje);
                }
                const payload = data as { items: ProbeHistorial[]; resumen24h: Resumen24h | null };
                setItems(payload.items ?? []);
                setResumen(payload.resumen24h);
            })
            .catch((err) => setError(err instanceof Error ? err.message : String(err)))
            .finally(() => setCargando(false));
    }, [abierto]);

    if (!abierto) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Historial de chequeos del Cerebro IA"
            onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
        >
            <div className="max-h-[80vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-fondo shadow-xl">
                <div className="flex items-center justify-between border-b border-borde p-4">
                    <h2 className="text-lg font-semibold text-body">Historial del Cerebro IA</h2>
                    <button
                        type="button"
                        onClick={onCerrar}
                        className="rounded-lg px-3 py-1 text-sm text-muted hover:bg-fondo-oscuro"
                        aria-label="Cerrar historial"
                    >
                        Cerrar
                    </button>
                </div>

                <div className="space-y-4 overflow-y-auto p-4">
                    {resumen && (
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div className="rounded-xl bg-fondo-oscuro p-3 text-center">
                                <p className="text-2xl font-bold text-body">{resumen.pings}</p>
                                <p className="text-xs text-muted">Pings</p>
                            </div>
                            <div className="rounded-xl bg-fondo-oscuro p-3 text-center">
                                <p className="text-2xl font-bold text-body">{resumen.piggybacks}</p>
                                <p className="text-xs text-muted">Piggybacks</p>
                            </div>
                            <div className="rounded-xl bg-fondo-oscuro p-3 text-center">
                                <p className="text-2xl font-bold text-body">{resumen.smokes}</p>
                                <p className="text-xs text-muted">Smokes reales</p>
                            </div>
                            <div className="rounded-xl bg-fondo-oscuro p-3 text-center">
                                <p className="text-2xl font-bold text-body">{resumen.fallos}</p>
                                <p className="text-xs text-muted">Fallos</p>
                            </div>
                        </div>
                    )}
                    <p className="text-xs text-muted">En las últimas 24 horas.</p>

                    {cargando && <Cargando texto="Cargando historial..." />}
                    {error && <ErrorState title="No se pudo cargar el historial" description={error} onRetry={() => window.location.reload()} />}

                    {!cargando && !error && items.length === 0 && (
                        <p className="py-8 text-center text-sm text-muted">Aún no hay chequeos registrados.</p>
                    )}

                    {!cargando && !error && items.length > 0 && (
                        <table className="w-full text-left text-sm">
                            <thead className="text-xs uppercase text-muted">
                                <tr>
                                    <th className="pb-2 font-medium">Hora</th>
                                    <th className="pb-2 font-medium">Método</th>
                                    <th className="pb-2 font-medium">Resultado</th>
                                    <th className="pb-2 font-medium">Motivo / latencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.id} className="border-t border-borde">
                                        <td className="py-2 text-body">
                                            {new Date(item.creadoEn).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" })}
                                        </td>
                                        <td className="py-2 text-body">{etiquetaMetodo(item.metodo)}</td>
                                        <td className="py-2">
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${claseBadge(item.ok)}`}>
                                                {item.ok ? "OK" : "Fallo"}
                                            </span>
                                        </td>
                                        <td className="py-2 text-muted">
                                            {item.latenciaMs > 0 ? `${item.latenciaMs} ms` : null}
                                            {item.latenciaMs > 0 && item.detalle ? " · " : null}
                                            {item.detalle ?? "—"}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
}
