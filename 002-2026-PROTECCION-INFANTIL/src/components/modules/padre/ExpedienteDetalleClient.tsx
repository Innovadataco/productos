"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { TimelineEventos } from "./TimelineEventos";
import { AgregarEventoForm } from "./AgregarEventoForm";
import { LABELS_ESTADO, LABELS_SCORE, COLORES_SCORE } from "@/lib/padre/expediente-ui";
import type { EstadoExpediente, ScoreGravedad } from "@prisma/client";

interface EventoItem {
    id: string;
    ordenSecuencial: number;
    fechaEvento: Date;
    texto: string;
    categoriaDetectada: string | null;
    confianzaClasificacion: number | null;
    plataforma: string | null;
}

interface ExpedienteDetalleClientProps {
    expediente: {
        id: string;
        identificadorReportado: string;
        estado: EstadoExpediente;
        scoreGravedadActual: ScoreGravedad;
        fechaApertura: Date;
        numEventos: number;
    };
    eventos: EventoItem[];
}

export function ExpedienteDetalleClient({ expediente, eventos }: ExpedienteDetalleClientProps) {
    const router = useRouter();
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const esEditable = expediente.estado === "ACTIVO";

    return (
        <div className="space-y-6">
            <GlassCard className="p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold text-body">{expediente.identificadorReportado}</h1>
                        <p className="mt-1 text-sm text-muted">
                            {LABELS_ESTADO[expediente.estado]} · Abierto el {new Date(expediente.fechaApertura).toLocaleDateString("es-CO")} · {expediente.numEventos} {expediente.numEventos === 1 ? "evento" : "eventos"}
                        </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${COLORES_SCORE[expediente.scoreGravedadActual]}`}>
                        {LABELS_SCORE[expediente.scoreGravedadActual]}
                    </span>
                </div>
                {esEditable && (
                    <div className="mt-4">
                        <button
                            type="button"
                            onClick={() => setMostrarFormulario(true)}
                            className="rounded-xl accent-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                        >
                            Agregar nueva situación
                        </button>
                    </div>
                )}
            </GlassCard>

            {mostrarFormulario && esEditable && (
                <AgregarEventoForm
                    expedienteId={expediente.id}
                    onCancel={() => setMostrarFormulario(false)}
                    onSuccess={() => {
                        setMostrarFormulario(false);
                        router.refresh();
                    }}
                />
            )}

            <section>
                <h2 className="mb-4 text-lg font-semibold text-body">Cronología</h2>
                <TimelineEventos eventos={eventos} />
            </section>
        </div>
    );
}
