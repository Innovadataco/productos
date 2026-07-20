"use client";

import { useState } from "react";
import { LaboratorioTab } from "./eval/LaboratorioTab";
import { CasosTab } from "./eval/CasosTab";
import { HistorialTab } from "./eval/HistorialTab";
import { SimulacionTab } from "./simulacion/SimulacionTab";

export function IaEvalManager() {
    const [activeTab, setActiveTab] = useState<"casos" | "laboratorio" | "historial" | "simulacion">("laboratorio");

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-6" aria-label="Eval tabs">
                    {[
                        { key: "laboratorio", label: "Laboratorio" },
                        { key: "casos", label: "Casos del fixture" },
                        { key: "historial", label: "Historial" },
                        { key: "simulacion", label: "Simulación" },
                    ].map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setActiveTab(t.key as typeof activeTab)}
                            className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                                activeTab === t.key
                                    ? "border-sky-500 text-sky-600 dark:border-cyan-400 dark:text-cyan-400"
                                    : "border-transparent text-muted hover:border-slate-300 hover:text-body dark:hover:border-slate-600"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === "laboratorio" && <LaboratorioTab />}
            {activeTab === "casos" && <CasosTab />}
            {activeTab === "historial" && <HistorialTab />}
            {activeTab === "simulacion" && <SimulacionTab />}
        </div>
    );
}
