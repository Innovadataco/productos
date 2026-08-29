import type { ReactNode } from "react";
import { LuzAmbiental } from "./LuzAmbiental";
import type { EstadoSistema } from "./Anillo";

/**
 * SPEC-157 (§4.6) — Panel de vidrio con algo detrás.
 * El vidrio (saturate(185%) blur(22px), luz interior en oscuro) vive en las clases
 * semánticas `glass`/`glass-strong` de globals.css; con `estado` se compone el campo
 * de LuzAmbiental detrás del panel.
 */

interface PanelVidrioProps {
    estado?: EstadoSistema;
    tone?: "default" | "strong";
    className?: string;
    children: ReactNode;
}

export function PanelVidrio({ estado, tone = "default", className = "", children }: PanelVidrioProps) {
    const vidrio = tone === "strong" ? "glass-strong" : "glass";
    const panel = (
        <div className={`${vidrio} rounded-[var(--radio-card)] ${className}`}>{children}</div>
    );

    if (!estado) return panel;

    return (
        <div className="relative rounded-[var(--radio-card)]">
            <LuzAmbiental estado={estado} />
            {panel}
        </div>
    );
}
