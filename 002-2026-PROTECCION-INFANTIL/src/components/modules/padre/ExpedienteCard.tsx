import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { LABELS_ESTADO, LABELS_SCORE, COLORES_SCORE, diasDesdeUltimaActividad } from "@/lib/padre/expediente-ui";
import type { EstadoExpediente, ScoreGravedad } from "@prisma/client";

interface ExpedienteCardProps {
    id: string;
    identificadorReportado: string;
    estado: EstadoExpediente;
    scoreGravedadActual: ScoreGravedad;
    fechaApertura: Date;
    ultimoEventoEn: Date | null;
    numEventos: number;
}

export function ExpedienteCard({
    id,
    identificadorReportado,
    estado,
    scoreGravedadActual,
    fechaApertura,
    ultimoEventoEn,
    numEventos,
}: ExpedienteCardProps) {
    const dias = ultimoEventoEn ? diasDesdeUltimaActividad(ultimoEventoEn) : diasDesdeUltimaActividad(fechaApertura);

    return (
        <Link href={`/dashboard/padre/expedientes/${id}`} className="block">
            <GlassCard className="p-5 transition hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-semibold text-body">{identificadorReportado}</h3>
                        <p className="mt-1 text-sm text-muted">
                            {LABELS_ESTADO[estado]} · {numEventos} {numEventos === 1 ? "evento" : "eventos"}
                        </p>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${COLORES_SCORE[scoreGravedadActual]}`}>
                        {LABELS_SCORE[scoreGravedadActual]}
                    </span>
                </div>
                <div className="mt-4 flex items-center justify-between text-xs text-muted">
                    <span>Abierto {new Date(fechaApertura).toLocaleDateString("es-CO")}</span>
                    <span>{dias === 0 ? "Hoy" : `Hace ${dias} día${dias === 1 ? "" : "s"}`}</span>
                </div>
            </GlassCard>
        </Link>
    );
}
