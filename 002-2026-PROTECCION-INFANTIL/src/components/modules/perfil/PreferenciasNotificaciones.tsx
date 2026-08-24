"use client";

import { useEffect, useState } from "react";
import { Loader2, Mail, Bell, Lock } from "lucide-react";
import { Switch } from "@/components/ui/Switch";
import { Tooltip } from "@/components/ui/Tooltip";
import { ErrorState } from "@/components/ui/ErrorState";
import { Cargando } from "@/components/ui/Cargando";

type Canal = "EMAIL" | "IN_APP";

type ReglaPreferencia = {
    evento: string;
    canal: Canal;
    eventoRegla: string;
    obligatoria: boolean;
    habilitado: boolean;
};

type GrupoPreferencia = {
    evento: string;
    canales: ReglaPreferencia[];
};

const LABEL_CANAL: Record<Canal, string> = {
    EMAIL: "Email",
    IN_APP: "In-app",
};

function formatearEvento(evento: string): string {
    return evento
        .split(".")
        .map((parte) => parte.charAt(0).toUpperCase() + parte.slice(1))
        .join(" › ");
}

export function PreferenciasNotificaciones() {
    const [grupos, setGrupos] = useState<GrupoPreferencia[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [guardando, setGuardando] = useState<Set<string>>(new Set());

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/notificaciones/preferencias");
            if (!res.ok) throw new Error("Error al cargar preferencias");
            const json = (await res.json()) as { preferencias: GrupoPreferencia[] };
            setGrupos(json.preferencias ?? []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setLoading(false);
        }
    }

    async function cambiar(regla: ReglaPreferencia, habilitado: boolean) {
        if (regla.obligatoria) return;
        setGuardando((prev) => new Set(prev).add(regla.eventoRegla));
        try {
            const res = await fetch("/api/notificaciones", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ eventoRegla: regla.eventoRegla, habilitado }),
            });
            if (!res.ok) {
                const json = (await res.json()) as { error?: string };
                throw new Error(json.error === "regla_obligatoria" ? "Esta notificación es obligatoria y no se puede desactivar." : "Error al guardar");
            }
            setGrupos((prev) =>
                prev.map((g) => ({
                    ...g,
                    canales: g.canales.map((c) =>
                        c.eventoRegla === regla.eventoRegla ? { ...c, habilitado } : c
                    ),
                }))
            );
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error");
        } finally {
            setGuardando((prev) => {
                const next = new Set(prev);
                next.delete(regla.eventoRegla);
                return next;
            });
        }
    }

    useEffect(() => {
        void cargar();
    }, []);

    if (loading) {
        return (
            <div className="glass rounded-2xl p-8 text-center">
                <Cargando texto="Cargando preferencias…" />
            </div>
        );
    }

    if (error && grupos.length === 0) {
        return (
            <ErrorState
                title="No pudimos cargar tus preferencias"
                description={error}
                onRetry={() => void cargar()}
            />
        );
    }

    if (grupos.length === 0) {
        return (
            <div className="glass rounded-2xl p-8 text-center text-muted">
                No hay notificaciones configurables para tu rol.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {error && (
                <p className="rounded-xl bg-rubi/10 px-4 py-3 text-sm text-rubi-ink" role="alert">
                    {error}
                </p>
            )}
            {grupos.map((grupo) => (
                <section key={grupo.evento} className="glass rounded-2xl p-5">
                    <h3 className="text-base font-semibold text-body">{formatearEvento(grupo.evento)}</h3>
                    <div className="mt-4 space-y-3">
                        {grupo.canales.map((regla) => {
                            const Icon = regla.canal === "EMAIL" ? Mail : Bell;
                            const toggle = (
                                <div className="flex items-center gap-3">
                                    <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
                                    <span className="text-sm text-body">{LABEL_CANAL[regla.canal]}</span>
                                    {regla.obligatoria ? (
                                        <Tooltip content="Transaccional — no se puede apagar (necesario para el servicio)">
                                            <span className="inline-flex items-center gap-1 rounded-full bg-tinta/5 px-2 py-1 text-xs text-muted">
                                                <Lock className="h-3 w-3" aria-hidden="true" />
                                                Obligatoria
                                            </span>
                                        </Tooltip>
                                    ) : null}
                                    {guardando.has(regla.eventoRegla) ? (
                                        <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden="true" />
                                    ) : (
                                        <Switch
                                            checked={regla.habilitado}
                                            onChange={(v) => void cambiar(regla, v)}
                                            disabled={regla.obligatoria}
                                            ariaLabel={`${LABEL_CANAL[regla.canal]} para ${grupo.evento}`}
                                        />
                                    )}
                                </div>
                            );
                            return <div key={regla.eventoRegla}>{toggle}</div>;
                        })}
                    </div>
                </section>
            ))}
        </div>
    );
}
