import { GlassCard } from "@/components/ui/GlassCard";

/**
 * SPEC-211 (002-PI-111): bloque 6 — contrato firmado. Visible para colegios
 * siempre (obligatorio por defecto) y para padres solo si el parámetro
 * `pagos.contrato_obligatorio_padres` lo exige (la página decide con
 * `mostrarContrato`). Componente puro.
 */
export function ContratoCard({
    contratoPDFUrl,
    contratoObligatorio,
}: {
    contratoPDFUrl: string | null;
    contratoObligatorio: boolean;
}) {
    return (
        <GlassCard data-testid="bloque-contrato" className="p-6">
            <h2 className="text-lg font-bold text-body">Contrato firmado</h2>
            {contratoPDFUrl ? (
                <div className="mt-3">
                    <p className="text-sm text-muted">Tu contrato está registrado.</p>
                    <a
                        href={contratoPDFUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cielo hover:underline"
                    >
                        Ver contrato (PDF)
                    </a>
                </div>
            ) : contratoObligatorio ? (
                <p className="mt-3 rounded-xl bg-ambar/10 px-4 py-2 text-sm font-medium text-ambar">
                    Aún no hay un contrato firmado registrado. El equipo se pondrá en contacto para completarlo.
                </p>
            ) : (
                <p className="mt-3 text-sm text-muted">No hay un contrato registrado; no es obligatorio para tu plan.</p>
            )}
        </GlassCard>
    );
}
