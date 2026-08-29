"use client";

import { useState } from "react";
import { PlanesAdminCRUD } from "./PlanesAdminCRUD";
import { ParametrosPagosForm } from "./ParametrosPagosForm";

const TABS = [
    { id: "catalogo", label: "Catálogo" },
    { id: "configuracion", label: "Configuración global" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function PlanesPagosTabs() {
    const [active, setActive] = useState<TabId>("catalogo");

    return (
        <div className="space-y-4">
            <div className="flex gap-2 border-b border-tinta/10 dark:border-tinta/20">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActive(tab.id)}
                        className={`px-4 py-2 text-sm font-medium transition ${
                            active === tab.id
                                ? "border-b-2 border-ambar text-ambar"
                                : "text-muted hover:text-body"
                        }`}
                        type="button"
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {active === "catalogo" && <PlanesAdminCRUD />}
            {active === "configuracion" && <ParametrosPagosForm />}
        </div>
    );
}
