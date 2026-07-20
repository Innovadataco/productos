"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SimulacionCard } from "./SimulacionCard";
import { NuevaSimulacionForm } from "./NuevaSimulacionForm";
import { SimulacionDashboard } from "./SimulacionDashboard";
import { ComparadorSimulaciones } from "./ComparadorSimulaciones";
import type { SimulacionRun } from "./types";

export function SimulacionTab() {
    const [view, setView] = useState<"list" | "new" | "detail" | "compare">("list");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [runs, setRuns] = useState<SimulacionRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/ia/simulaciones", { credentials: "include", cache: "no-store" });
            const data = await res.json();
            if (res.ok) setRuns(data.items || []);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        load();
    }, [refreshTick]);

    return (
        <div className="space-y-6">
            {view === "list" && (
                <>
                    <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-body">Simulaciones</h3>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setView("compare")} disabled={runs.length < 2}>
                                Comparar
                            </Button>
                            <Button onClick={() => setView("new")}>Nueva simulación</Button>
                        </div>
                    </div>
                    {loading ? (
                        <p className="text-sm text-muted">Cargando...</p>
                    ) : runs.length === 0 ? (
                        <EmptyState
                            title="Aún no hay simulaciones"
                            description="Crea una simulación para comparar modelos de clasificación bajo carga."
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {runs.map((run) => (
                                <SimulacionCard
                                    key={run.id}
                                    run={run}
                                    onClick={() => {
                                        setSelectedId(run.id);
                                        setView("detail");
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            {view === "new" && (
                <NuevaSimulacionForm
                    onBack={() => setView("list")}
                    onCreated={() => {
                        setView("list");
                        setRefreshTick((t) => t + 1);
                    }}
                />
            )}
            {view === "detail" && selectedId && (
                <SimulacionDashboard
                    id={selectedId}
                    onBack={() => setView("list")}
                    onRefresh={() => setRefreshTick((t) => t + 1)}
                />
            )}
            {view === "compare" && (
                <ComparadorSimulaciones
                    runs={runs}
                    onBack={() => setView("list")}
                    onRepeat={(casosJson) => {
                        setSelectedId(null);
                        setView("new");
                        // El formulario leerá los casos de localStorage
                        localStorage.setItem("simulacion_repeat_casos", JSON.stringify(casosJson));
                    }}
                />
            )}
        </div>
    );
}
