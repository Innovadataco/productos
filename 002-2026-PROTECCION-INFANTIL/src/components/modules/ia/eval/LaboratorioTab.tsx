"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ExperimentCard } from "./ExperimentCard";
import { NuevoExperimentoForm } from "./NuevoExperimentoForm";
import { ExperimentoDashboard } from "./ExperimentoDashboard";
import { ComparadorExperimentos } from "./ComparadorExperimentos";
import type { Experimento } from "./types";

export function LaboratorioTab() {
    const [view, setView] = useState<"list" | "new" | "detail" | "compare">("list");
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [experiments, setExperiments] = useState<Experimento[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshTick, setRefreshTick] = useState(0);

    async function load() {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/ia/experimentos?estado=COMPLETADA", { credentials: "include", cache: "no-store" });
            const data = await res.json();
            if (res.ok) setExperiments(data.items || []);
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
                        <h3 className="text-lg font-semibold text-body">Experimentos</h3>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setView("compare")} disabled={experiments.length < 2}>
                                Comparar
                            </Button>
                            <Button onClick={() => setView("new")}>Nuevo experimento</Button>
                        </div>
                    </div>
                    {loading ? (
                        <p className="text-sm text-muted">Cargando...</p>
                    ) : experiments.length === 0 ? (
                        <EmptyState
                            title="Aún no hay experimentos"
                            description="Crea un experimento para comparar configuraciones del modelo de clasificación."
                        />
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {experiments.map((exp) => (
                                <ExperimentCard
                                    key={exp.id}
                                    exp={exp}
                                    onClick={() => {
                                        setSelectedId(exp.id);
                                        setView("detail");
                                    }}
                                />
                            ))}
                        </div>
                    )}
                </>
            )}
            {view === "new" && <NuevoExperimentoForm onBack={() => setView("list")} onCreated={() => { setView("list"); setRefreshTick((t) => t + 1); }} />}
            {view === "detail" && selectedId && (
                <ExperimentoDashboard
                    id={selectedId}
                    onBack={() => setView("list")}
                    onRefresh={() => setRefreshTick((t) => t + 1)}
                />
            )}
            {view === "compare" && <ComparadorExperimentos experiments={experiments} onBack={() => setView("list")} />}
        </div>
    );
}
