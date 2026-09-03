"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { OperadoresSubNav } from "../components/OperadoresSubNav";
import { ErrorState } from "@/components/ui/ErrorState";
import { EmptyState } from "@/components/ui/EmptyState";
import { Cargando } from "@/components/ui/Cargando";
import { Tabla, TablaBody, TablaHead } from "@/components/ui/Tabla";

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

// SPEC-372 (A-74 · P3): el mismo tipo que retorna `reconciliarHuerfanos`. Se
// muestra en un aviso debajo del botón — no hace falta un modal para tres números.
type ResumenReconciliacion = {
    encontrados: number;
    asignados: number;
    fallidos: number;
    deshabilitado?: boolean;
};

export default function AdminOperadoresAsignarPage() {
    const [data, setData] = useState<EstadoAsignacion | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    // SPEC-372 (A-74 · P3): estado del disparo manual de reconciliación.
    const [reconciliando, setReconciliando] = useState(false);
    const [ultimoResumen, setUltimoResumen] = useState<ResumenReconciliacion | null>(null);
    const [errorReconciliar, setErrorReconciliar] = useState("");

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

    // SPEC-372 (A-74 · P3): botón "Asignar huérfanos ahora". Dispara ya la misma
    // tarea del cron cada 15 min (worker `operadores-reconciliacion-huerfanos`),
    // para que el admin no tenga que esperar cuando la cola quedó atrás. Al
    // terminar, refresca el resumen — así se ve cómo bajó "sin asignar".
    async function reconciliarAhora() {
        setReconciliando(true);
        setErrorReconciliar("");
        try {
            const res = await fetch("/api/admin/operadores/reconciliacion", {
                method: "POST",
                credentials: "include",
            });
            const json = await res.json().catch(() => ({}));
            if (res.ok) {
                setUltimoResumen(json);
                await cargar();
            } else {
                setErrorReconciliar(json?.error?.message || "No se pudo asignar los huérfanos.");
            }
        } catch {
            setErrorReconciliar("Error de red al intentar asignar los huérfanos.");
        } finally {
            setReconciliando(false);
        }
    }

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Asignación de casos</h1>
                <p className="text-sm text-muted">
                    Estado en vivo de la cola de revisión manual y la carga de cada operador.
                </p>
            </div>

            <OperadoresSubNav />

            {error && (
                <ErrorState
                    title="No pudimos cargar el estado de asignación"
                    description="Ocurrió un problema al consultar la cola de operadores. Intenta de nuevo."
                    onRetry={cargar}
                />
            )}

            <section className="space-y-4" aria-labelledby="asignacion-resumen-title">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="asignacion-resumen-title" className="text-lg font-semibold text-body">Resumen de la cola</h2>
                    <div className="flex flex-wrap items-center gap-2">
                        {/* SPEC-372 (A-74 · P3): fuerza AHORA la reconciliación que
                            corre cada 15 min. Deshabilitado si la cola ya está en 0. */}
                        <Button
                            variant="primary"
                            onClick={reconciliarAhora}
                            isLoading={reconciliando}
                            disabled={loading || !data || data.sinAsignar === 0}
                            title={
                                data && data.sinAsignar === 0
                                    ? "No hay reportes sin asignar."
                                    : "Dispara ahora la asignación automática (idempotente con el cron)."
                            }
                        >
                            Asignar huérfanos ahora
                        </Button>
                        <Button variant="outline" onClick={cargar} isLoading={loading}>
                            Actualizar
                        </Button>
                    </div>
                </div>
                {(ultimoResumen || errorReconciliar) && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="rounded-lg border border-slate-200 bg-white/70 p-3 text-sm text-body dark:border-slate-800 dark:bg-slate-900/60"
                    >
                        {errorReconciliar ? (
                            <span className="text-body">{errorReconciliar}</span>
                        ) : ultimoResumen?.deshabilitado ? (
                            <span>La reconciliación está desactivada por parámetro (<span className="font-mono text-xs">operadores.reconciliacion_enabled</span>).</span>
                        ) : ultimoResumen ? (
                            <span>
                                Último intento: <b>{ultimoResumen.encontrados}</b> reportes sin operador,{" "}
                                <b>{ultimoResumen.asignados}</b> asignados,{" "}
                                <Badge variant={ultimoResumen.fallidos > 0 ? "warning" : "neutral"}>
                                    {ultimoResumen.fallidos} sin cupo
                                </Badge>
                                .
                            </span>
                        ) : null}
                    </div>
                )}
                <div className="text-sm text-muted">
                    Estrategia actual: <span className="font-medium text-body">{data?.estrategia ?? "—"}</span>
                    {" · "}
                    Cupo default: <span className="font-medium text-body">{data?.cupoDefault ?? "—"}</span>
                </div>
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
            </section>

            <GlassCard>
                <h2 className="text-lg font-semibold text-body">Operadores activos</h2>
                {loading ? (
                    <Cargando inline className="py-8" />
                ) : data?.operadores.length === 0 ? (
                    <EmptyState
                        title="No hay operadores activos"
                        description="Cuando haya operadores disponibles, podrás ver su carga de casos aquí."
                    />
                ) : (
                    <div className="mt-4">
                        <Tabla sinContenedor>
                            <TablaHead variante="borde">
                                <tr className="text-subtle">
                                    <th className="pb-3 font-medium">Operador</th>
                                    <th className="pb-3 font-medium">Cupo</th>
                                    <th className="pb-3 font-medium">Casos abiertos</th>
                                    <th className="pb-3 font-medium">Libre</th>
                                    <th className="pb-3 font-medium">Apelaciones</th>
                                    <th className="pb-3 font-medium text-right">Uso</th>
                                </tr>
                            </TablaHead>
                            <TablaBody>
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
                                                    <Link
                                                        href={`/dashboard/admin/operadores/${op.id}`}
                                                        className="rounded-lg border border-slate-300 px-3 py-1 text-xs text-body hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                                                    >
                                                        Ver detalle
                                                    </Link>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </TablaBody>
                        </Tabla>
                    </div>
                )}
            </GlassCard>

        </div>
    );
}
