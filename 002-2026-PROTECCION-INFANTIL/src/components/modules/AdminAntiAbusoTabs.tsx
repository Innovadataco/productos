"use client";

import { useState } from "react";
import { AdminAntiAbusoOperativo } from "./AdminAntiAbusoOperativo";
import { AdminAntiAbusoSimulacion } from "./AdminAntiAbusoSimulacion";

const TABS = [
    { id: "operativo", label: "Operativo" },
    { id: "scoring", label: "Scoring por fuente" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function AdminAntiAbusoTabs() {
    const [tab, setTab] = useState<TabId>("operativo");

    return (
        <section className="space-y-6" aria-labelledby="anti-abuso-title">
            <div>
                <h1 id="anti-abuso-title" className="text-2xl font-bold text-body">Anti-abuso</h1>
                <p className="mt-1 text-sm text-muted">Vigilancia operativa, scoring por fuente y simulación de abusos.</p>
            </div>

            <div role="tablist" aria-label="Secciones anti-abuso" className="flex gap-2 border-b border-tinta/10 pb-1">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        role="tab"
                        aria-selected={tab === t.id}
                        aria-controls={`anti-abuso-panel-${t.id}`}
                        onClick={() => setTab(t.id)}
                        className={`px-4 py-2 text-sm font-semibold transition ${
                            tab === t.id
                                ? "border-b-2 border-sky-600 text-sky-700"
                                : "text-muted hover:text-body"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            <div id={`anti-abuso-panel-${tab}`} role="tabpanel" aria-labelledby={`anti-abuso-tab-${tab}`}>
                {tab === "operativo" && <AdminAntiAbusoOperativo />}
                {tab === "scoring" && <AdminAntiAbusoSimulacion />}
            </div>
        </section>
    );
}
