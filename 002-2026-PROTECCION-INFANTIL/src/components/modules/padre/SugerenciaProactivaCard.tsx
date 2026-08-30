"use client";

import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import type { TipoSugerencia, SugerenciaProactiva as SugerenciaData } from "@/lib/padre/sugerencia-proactiva";

interface SugerenciaProactivaCardProps {
    sugerencia: SugerenciaData;
}

const CONFIG: Record<TipoSugerencia, { icono: string; clases: string; anillo: string }> = {
    INVITAR_CONTACTOS: {
        icono: "👋",
        clases: "bg-cielo/10 text-cielo border-cielo/30",
        anillo: "ring-cielo/30",
    },
    TODO_VERDE: {
        icono: "✅",
        clases: "bg-pino/10 text-pino border-pino/30",
        anillo: "ring-pino/30",
    },
    SIN_NOVEDADES: {
        icono: "🍃",
        clases: "bg-tinta/10 text-body border-tinta/20",
        anillo: "ring-tinta/20",
    },
    AMBAR: {
        icono: "⚠️",
        clases: "bg-ambar/10 text-ambar border-ambar/30",
        anillo: "ring-ambar/30",
    },
    ROJO: {
        icono: "🚨",
        clases: "bg-rubi/10 text-rubi border-rubi/30",
        anillo: "ring-rubi/30",
    },
};

export function SugerenciaProactivaCard({ sugerencia }: SugerenciaProactivaCardProps) {
    const config = CONFIG[sugerencia.tipo];

    return (
        <GlassCard className={`border ${config.clases}`}>
            <div className="flex items-start gap-4">
                <span
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-lg ring-4 ${config.anillo}`}
                    aria-hidden="true"
                >
                    {config.icono}
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold">{sugerencia.titulo}</h2>
                    <p className="mt-1 text-sm opacity-90">{sugerencia.mensaje}</p>
                    <div className="mt-3">
                        <Link
                            href={sugerencia.accion.href}
                            className="inline-flex items-center rounded-lg bg-cielo px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-cielo/90"
                        >
                            {sugerencia.accion.etiqueta}
                        </Link>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
}
