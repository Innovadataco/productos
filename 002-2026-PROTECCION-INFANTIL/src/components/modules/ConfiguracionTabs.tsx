"use client";

import { useState } from "react";
import ConfigPanel from "@/components/modules/ConfigPanel";
import { PermisosRolPanel } from "@/components/modules/PermisosRolPanel";
import GuiasAccionAdminClient from "@/components/modules/guias-accion/GuiasAccionAdminClient";

const TABS = [
    { key: "parametros", label: "Parámetros" },
    { key: "permisos", label: "Permisos por rol" },
    // SPEC-235 (002-PI-135): guías de acción parametrizables bajo configuración.
    { key: "guias", label: "Guías de acción" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ConfiguracionTabs() {
    const [tab, setTab] = useState<TabKey>("parametros");

    return (
        <div className="space-y-6">
            <div className="border-b border-tinta/10 dark:border-tinta/15">
                <nav className="-mb-px flex gap-6" aria-label="Tabs de configuración">
                    {TABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                                tab === t.key
                                    ? "border-cielo text-cielo dark:border-cielo dark:text-cielo"
                                    : "border-transparent text-muted hover:border-tinta/15 hover:text-body dark:hover:border-tinta/15"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>
            {tab === "parametros" && <ConfigPanel />}
            {tab === "permisos" && <PermisosRolPanel />}
            {tab === "guias" && <GuiasAccionAdminClient />}
        </div>
    );
}
