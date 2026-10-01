import { GlassCard } from "@/components/ui/GlassCard";

/**
 * SPEC-211 (002-PI-111) · SPEC-796 (contrato firmado del colegio).
 *
 * Bloque 6 — contrato firmado. Con contrato: lo muestra como REGISTRADO (nunca «válido/verificado/
 * firmado digitalmente»: no validamos la firma, solo lo tenemos en archivo — FORMA-SPEC796 §0) y el
 * enlace «Ver contrato» va a un ENDPOINT GUARDADO por el servidor (`/api/colegio/contrato/pdf`), no
 * a una URL pública/adivinable (el `contratoPDFUrl` directo quedó deprecado). Sin contrato: el texto
 * ámbar aprobado, INTACTO mientras el hueco exista. Componente puro.
 */
const FMT_FECHA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", dateStyle: "long" });

export function ContratoCard({
    contrato,
    contratoObligatorio,
}: {
    contrato: { adjuntadoEn: string } | null;
    contratoObligatorio: boolean;
}) {
    return (
        <GlassCard data-testid="bloque-contrato" className="p-6">
            <h2 className="text-lg font-bold text-body">Contrato firmado</h2>
            {contrato ? (
                <div className="mt-3">
                    <p className="text-sm text-muted">Tenemos tu contrato en archivo.</p>
                    <a
                        href="/api/colegio/contrato/pdf"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cielo hover:underline"
                    >
                        Ver contrato (PDF)
                    </a>
                    <p className="mt-2 text-xs text-subtle">Registrado el {FMT_FECHA.format(new Date(contrato.adjuntadoEn))}.</p>
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
