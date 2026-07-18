"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OperadoresSubNav } from "../components/OperadoresSubNav";

type OperadorAsignacion = {
    id: string;
    email: string;
    nombre: string | null;
    esRevisorDeApelaciones: boolean;
    casosAbiertos: number;
    cupoMaximo: number;
    libre: number;
};

type EstadoAsignacion = {
    sinAsignar: number;
    operadores: OperadorAsignacion[];
    estrategia: string;
    cupoDefault: number;
};

export default function AdminOperadoresAsignarPage() {
    const [data, setData] = useState<EstadoAsignacion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reasingandoId, setReasignandoId] = useState<string | null>(null);

    async function cargar() {
        setLoading(true);
        setError("");
        try {
            const res = await fetch("/api/admin/operadores/asignacion", { credentials: "include" });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                setData(json);
            } else {
                setError(json?.error?.message || "Error cargando estado de asignación");
            }
        } catch {
            setError("Error de red cargando estado de asignación");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        cargar();
    }, []);

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Asignación de casos</h1>
                <p className="text-sm text-muted">
                    Estado en vivo de la cola de revisión manual y la carga de cada operador.
                </p>
            </div>

            <OperadoresSubNav />

            <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-muted">
                    Estrategia actual: <span className="font-medium text-body">{data?.estrategia ?? "—"}</span>
                    {" · "}
                    Cupo default: <span className="font-medium text-body">{data?.cupoDefault ?? "—"}</span>
                </div>
                <Button variant="outline" onClick={cargar} isLoading={loading}>
                    Actualizar
                </Button>
            </div>

            {error && (
                <div className="rounded-xl bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Casos sin asignar</p>
                    <p className="mt-1 text-3xl font-bold text-body">{data?.sinAsignar ?? 0}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Operadores activos</p>
                    <p className="mt-1 text-3xl font-bold text-body">{data?.operadores.length ?? 0}</p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Total casos en gestión</p>
                    <p className="mt-1 text-3xl font-bold text-body">
                        {data?.operadores.reduce((acc, o) => acc + o.casosAbiertos, 0) ?? 0}
                    </p>
                </GlassCard>
                <GlassCard className="p-5">
                    <p className="text-xs text-muted">Cupos libres</p>
                    <p className="mt-1 text-3xl font-bold text-body">
                        {data?.operadores.reduce((acc, o) => acc + o.libre, 0) ?? 0}
                    </p>
                </GlassCard>
            </div>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Operadores activos</h2>
                {loading ? (
                    <div className="flex items-center gap-3 py-8 text-muted">
                        <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-accent" />
                        Cargando...
                    </div>
                ) : data?.operadores.length === 0 ? (
                    <p className="py-6 text-sm text-muted">No hay operadores activos.</p>
                ) : (
                    <div className="mt-4 overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-slate-200 dark:border-slate-800">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Operador</th>
                                    <th className="pb-3 font-medium">Cupo</th>
                                    <th className="pb-3 font-medium">Casos abiertos</th>
                                    <th className="pb-3 font-medium">Libre</th>
                                    <th className="pb-3 font-medium">Apelaciones</th>
                                    <th className="pb-3 font-medium text-right">Uso</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {data?.operadores.map((op) => {
                                    const uso = op.cupoMaximo > 0 ? op.casosAbiertos / op.cupoMaximo : 0;
                                    return (
                                        <tr key={op.id} className="align-top">
                                            <td className="py-3 pr-3 text-body">
                                                <div className="font-medium">{op.nombre || op.email}</div>
                                                <div className="text-xs text-muted">{op.email}</div>
                                            </td>
                                            <td className="py-3 pr-3 text-muted">{op.cupoMaximo}</td>
                                            <td className="py-3 pr-3 text-muted">{op.casosAbiertos}</td>
                                            <td className="py-3 pr-3 text-muted">{op.libre}</td>
                                            <td className="py-3 pr-3 text-muted">
                                                {op.esRevisorDeApelaciones ? "Sí" : "No"}
                                            </td>
                                            <td className="py-3 text-right">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="text-xs text-muted">{Math.round(uso * 100)}%</span>
                                                    <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                                                        <div
                                                            className={`h-full rounded-full ${
                                                                uso >= 1
                                                                    ? "bg-red-500"
                                                                    : uso >= 0.7
                                                                      ? "bg-amber-500"
                                                                      : "bg-emerald-500"
                                                            }`}
                                                            style={{ width: `${Math.min(100, uso * 100)}%` }}
                                                        />
                                                    </div>
                                                    <Button
                                                        variant="outline"
                                                        className="px-3 py-1 text-xs"
                                                        isLoading={reasingandoId === op.id}
                                                        onClick={() => alert("Usar la reasignación manual desde la bandeja de casos.")}
                                                    >
                                                        Reasignar caso
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </GlassCard>
        </div>
    );
}
