"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { SeverityTimeline, TimelineEvento } from "@/lib/padre/timeline-circulo";

type TimelineEventoItemProps = Omit<TimelineEvento, "severity"> & {
    severity: SeverityTimeline;
};

const CONFIG_SEVERITY: Record<SeverityTimeline, { label: string; clases: string; punto: string }> = {
    VERDE: {
        label: "Bajo",
        clases: "bg-pino/10 text-pino border-pino/30",
        punto: "bg-pino",
    },
    AMARILLO: {
        label: "Medio",
        clases: "bg-ambar/10 text-ambar border-ambar/30",
        punto: "bg-ambar",
    },
    ROJO: {
        label: "Crítico",
        clases: "bg-rubi/10 text-rubi border-rubi/30",
        punto: "bg-rubi",
    },
};

function formatearFechaCorta(fechaIso: string): string {
    return new Date(fechaIso).toLocaleDateString("es-CO", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

export function TimelineEventoItem({
    fecha,
    severity,
    categoria,
    titulo,
    descripcion,
    expedienteId,
    contactoEtiqueta,
    identificador,
}: TimelineEventoItemProps) {
    const config = CONFIG_SEVERITY[severity];

    return (
        <GlassCard className="relative p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                    <span
                        className={`h-2.5 w-2.5 rounded-full ${config.punto}`}
                        aria-hidden="true"
                    />
                    <time className="text-sm font-semibold text-body">{formatearFechaCorta(fecha)}</time>
                </div>
                <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${config.clases}`}
                >
                    {config.label}
                </span>
            </div>

            <h3 className="mt-2 text-sm font-semibold text-body">{titulo}</h3>
            <p className="mt-1 text-sm text-muted">{descripcion}</p>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-subtle">
                {contactoEtiqueta && (
                    <span className="rounded-md bg-tinta/5 px-2 py-1">{contactoEtiqueta}</span>
                )}
                <span className="rounded-md bg-tinta/5 px-2 py-1">{identificador}</span>
                {categoria && (
                    <span className="rounded-md bg-tinta/5 px-2 py-1">{categoria}</span>
                )}
            </div>

            {expedienteId && (
                <div className="mt-4">
                    <Link
                        href={`/dashboard/padre/expedientes/${expedienteId}`}
                        className="inline-flex items-center rounded-lg bg-cielo px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cielo/90"
                    >
                        Abrir expediente
                    </Link>
                </div>
            )}
        </GlassCard>
    );
}
