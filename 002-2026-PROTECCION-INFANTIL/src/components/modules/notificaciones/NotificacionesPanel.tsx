"use client";

import { useState } from "react";
import { BandejaTab } from "./BandejaTab";
import { PlantillasTab } from "./PlantillasTab";
import { ReglasTab } from "./ReglasTab";
import { ParametrosNotificacionesTab } from "./ParametrosNotificacionesTab";

const SUBTABS = [
    { key: "bandeja", label: "Bandeja" },
    { key: "plantillas", label: "Plantillas" },
    { key: "reglas", label: "Reglas" },
    { key: "parametros", label: "Parámetros" },
] as const;

type SubTabKey = (typeof SUBTABS)[number]["key"];

export function NotificacionesPanel() {
    const [tab, setTab] = useState<SubTabKey>("bandeja");

    return (
        <div className="space-y-6">
            <div className="border-b border-tinta/10">
                <nav className="-mb-px flex flex-wrap gap-4" aria-label="Tabs de notificaciones">
                    {SUBTABS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center border-b-2 px-1 py-3 text-sm font-medium transition ${
                                tab === t.key
                                    ? "border-ambar text-ambar"
                                    : "border-transparent text-muted hover:border-tinta/30 hover:text-body dark:hover:border-tinta/30"
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </nav>
            </div>
            {tab === "bandeja" && <BandejaTab />}
            {tab === "plantillas" && <PlantillasTab />}
            {tab === "reglas" && <ReglasTab />}
            {tab === "parametros" && <ParametrosNotificacionesTab />}
        </div>
    );
}
