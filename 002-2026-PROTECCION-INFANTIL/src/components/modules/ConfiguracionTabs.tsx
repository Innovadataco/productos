"use client";

import { useState } from "react";
import ConfigPanel from "@/components/modules/ConfigPanel";
import { PermisosRolPanel } from "@/components/modules/PermisosRolPanel";

const TABS = [
    { key: "parametros", label: "Parámetros" },
    { key: "permisos", label: "Permisos por rol" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ConfiguracionTabs() {
    const [tab, setTab] = useState<TabKey>("parametros");

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-6" aria-label="Tabs de configuración">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                                tab === t.key
                                    ? "border-sky-500 text-sky-600 dark:border-cyan-400 dark:text-cyan-400"
                                    : "border-transparent text-muted hover:border-slate-300 hover:text-body dark:hover:border-slate-600"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>
            {tab === "parametros" ? <ConfigPanel /> : <PermisosRolPanel />}
        </div>
    );
}
