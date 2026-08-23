"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Cargando } from "@/components/ui/Cargando";
import { Alerta } from "@/components/ui/Alerta";
import { Input } from "@/components/ui/Input";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { ParametroNotificacionItem } from "./types";

const TIPO_LABELS: Record<string, string> = {
    STRING: "Texto",
    INTEGER: "Entero",
    FLOAT: "Decimal",
    BOOLEAN: "Booleano",
    JSON: "JSON",
    STRING_ARRAY: "Lista de textos",
};

export function ParametrosNotificacionesTab() {
    const [parametros, setParametros] = useState<ParametroNotificacionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const [editandoClave, setEditandoClave] = useState<string | null>(null);
    const [valorEdicion, setValorEdicion] = useState("");
    const [guardando, setGuardando] = useState<string | null>(null);

    const cargar = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/admin/notificaciones/parametros", { credentials: "include" });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error cargando parámetros");
            setParametros(body.items || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void cargar();
    }, [cargar]);

    function iniciarEdicion(p: ParametroNotificacionItem) {
        setEditandoClave(p.clave);
        setValorEdicion(p.valor);
        setMensaje(null);
        setError(null);
    }

    function cancelarEdicion() {
        setEditandoClave(null);
        setValorEdicion("");
    }

    async function guardar(clave: string) {
        setGuardando(clave);
        setError(null);
        setMensaje(null);
        try {
            const res = await fetch(`/api/admin/notificaciones/parametros/${encodeURIComponent(clave)}`, {
                method: "PATCH",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ valor: valorEdicion }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.error?.message || "Error al guardar");
            setParametros((prev) =>
                prev.map((p) => (p.clave === clave ? { ...p, valor: body.valor ?? valorEdicion } : p))
            );
            setMensaje(`Parámetro ${clave} actualizado.`);
            cancelarEdicion();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error de red");
        } finally {
            setGuardando(null);
        }
    }

    return (
        <div className="space-y-5">
            <GlassCard>
                <div className="mb-4">
                    <h2 className="text-lg font-semibold text-body">Parámetros del motor</h2>
                    <p className="text-sm text-muted">Ajustá los valores de configuración del motor de notificaciones.</p>
                </div>
                {mensaje && <Alerta tono="exito" className="mb-4">{mensaje}</Alerta>}
                {error && <Alerta tono="error" className="mb-4">{error}</Alerta>}

                {loading ? (
                    <Cargando texto="Cargando parámetros..." />
                ) : parametros.length === 0 ? (
                    <EmptyState title="Sin parámetros" description="No se encontraron parámetros del motor de notificaciones." />
                ) : (
                    <div className="space-y-3">
                        {parametros.map((p) => (
                            <div
                                key={p.id}
                                className="flex flex-col gap-3 rounded-xl border border-tinta/10 bg-papel/40 p-4 sm:flex-row sm:items-start sm:justify-between"
                            >
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium text-body">{p.clave}</span>
                                        <Badge variant="neutral">{TIPO_LABELS[p.tipo] ?? p.tipo}</Badge>
                                        {p.esSecreto && <Badge variant="warning">Secreto</Badge>}
                                    </div>
                                    {p.descripcion && <p className="mt-1 text-xs text-muted">{p.descripcion}</p>}
                                    {editandoClave !== p.clave && (
                                        <p className="mt-2 break-all font-mono text-sm text-body">{p.valor}</p>
                                    )}
                                </div>
                                <div className="flex items-start gap-2">
                                    {editandoClave === p.clave ? (
                                        <>
                                            <Input
                                                value={valorEdicion}
                                                onChange={(e) => setValorEdicion(e.target.value)}
                                                className="w-48 sm:w-64"
                                                disabled={guardando === p.clave}
                                            />
                                            <Button
                                                variant="ghost"
                                                onClick={cancelarEdicion}
                                                disabled={guardando === p.clave}
                                            >
                                                Cancelar
                                            </Button>
                                            <Button
                                                isLoading={guardando === p.clave}
                                                onClick={() => void guardar(p.clave)}
                                            >
                                                Guardar
                                            </Button>
                                        </>
                                    ) : (
                                        <Button variant="outline" onClick={() => iniciarEdicion(p)}>
                                            Editar
                                        </Button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
