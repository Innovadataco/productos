"use client";

import { useState } from "react";
import ConfigPanel from "@/components/modules/ConfigPanel";
import { PermisosRolPanel } from "@/components/modules/PermisosRolPanel";
import { NotificacionesPanel } from "@/components/modules/notificaciones/NotificacionesPanel";
import { useAuth } from "@/lib/contexts/AuthContext";

const TABS_BASE = [
    { key: "parametros", label: "Parámetros", adminOnly: false },
    { key: "notificaciones", label: "Notificaciones", adminOnly: true },
    { key: "permisos", label: "Permisos por rol", adminOnly: false },
] as const;

type TabKey = (typeof TABS_BASE)[number]["key"];

export function ConfiguracionTabs() {
    const { user } = useAuth();
    const tabs = TABS_BASE.filter((t) => (t.adminOnly ? user?.rol === "ADMIN" : true));
    const [tab, setTab] = useState<TabKey>("parametros");

    return (
        <div className="space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex gap-6" aria-label="Tabs de configuración">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                                tab === t.key
                                    ? "border-ambar text-ambar dark:border-ambar dark:text-ambar"
                                    : "border-transparent text-muted hover:border-slate-300 hover:text-body dark:hover:border-slate-600"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>
            {tab === "parametros" && <ConfigPanel />}
            {tab === "notificaciones" && <NotificacionesPanel />}
            {tab === "permisos" && <PermisosRolPanel />}
        </div>
    );
}
