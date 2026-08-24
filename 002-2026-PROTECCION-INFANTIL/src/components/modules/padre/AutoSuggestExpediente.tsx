import Link from "next/link";
import { GlassCard } from "@/components/ui/GlassCard";
import { diasDesdeUltimaActividad } from "@/lib/padre/expediente-ui";

interface AutoSuggestExpedienteProps {
    expedienteId: string;
    identificadorReportado: string;
    ultimoEventoEn: Date | null;
}

export function AutoSuggestExpediente({ expedienteId, identificadorReportado, ultimoEventoEn }: AutoSuggestExpedienteProps) {
    const dias = ultimoEventoEn ? diasDesdeUltimaActividad(ultimoEventoEn) : 0;

    return (
        <GlassCard className="mb-6 border-l-4 border-l-cielo-600 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-body">¿La situación continúa?</h2>
                    <p className="mt-1 text-sm text-muted">
                        Tienes 1 expediente activo sobre <span className="font-semibold text-body">{identificadorReportado}</span>
                        {dias > 0 ? ` · última actualización hace ${dias} día${dias === 1 ? "" : "s"}` : ""}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Link
                        href={`/dashboard/padre/expedientes/${expedienteId}`}
                        className="rounded-xl accent-gradient px-4 py-2 text-sm font-semibold text-white shadow-md transition hover:opacity-90"
                    >
                        Agregar nueva situación
                    </Link>
                    <button
                        type="button"
                        className="rounded-xl border border-tinta/20 px-4 py-2 text-sm font-semibold text-body transition hover:bg-tinta/5"
                        disabled
                        title="Disponible próximamente"
                    >
                        Ya se resolvió
                    </button>
                </div>
            </div>
        </GlassCard>
    );
}
