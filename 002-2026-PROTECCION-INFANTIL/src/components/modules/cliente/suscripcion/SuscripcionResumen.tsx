import { GlassCard } from "@/components/ui/GlassCard";
import { fechaCorta } from "@/lib/format/fecha";
import type { VistaSuscripcion } from "@/lib/pagos/suscripcion-vista.types";
import { estadoSuscripcionMeta, formatoLocal, formatoUSD, DURACION_LABEL } from "./util";

/**
 * SPEC-211 (002-PI-111): bloque 1 — resumen ejecutivo de la suscripción
 * (estado, plan, fechas en America/Bogota, días restantes y total pagado).
 * Componente puro: recibe el DTO, sin fetch ni estado.
 */
export function SuscripcionResumen({ vista }: { vista: VistaSuscripcion }) {
    const meta = estadoSuscripcionMeta(vista.estado);
    const dias = vista.diasRestantes;
    const textoDias =
        vista.estado === "CANCELADA"
            ? "—"
            : dias < 0
                ? `Vencida hace ${Math.abs(dias)} días`
                : dias === 0
                    ? "Vence hoy"
                    : `${dias} días restantes`;

    return (
        <GlassCard data-testid="bloque-resumen" className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-lg font-bold text-body">{vista.plan.nombre}</h2>
                    <p className="mt-1 text-sm text-muted">
                        Duración del plan: {DURACION_LABEL[vista.plan.duracion] ?? vista.plan.duracion}
                    </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${meta.clases}`}>
                    {meta.label}
                </span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                    <dt className="text-xs text-subtle">Inicio</dt>
                    <dd className="mt-1 text-sm font-semibold text-body">{fechaCorta(vista.fechaInicio)}</dd>
                </div>
                <div>
                    <dt className="text-xs text-subtle">Fin de vigencia</dt>
                    <dd className="mt-1 text-sm font-semibold text-body">{fechaCorta(vista.fechaFin)}</dd>
                </div>
                <div>
                    <dt className="text-xs text-subtle">Vigencia</dt>
                    <dd className="mt-1 text-sm font-semibold text-body">{textoDias}</dd>
                </div>
                <div>
                    <dt className="text-xs text-subtle">Total pagado histórico</dt>
                    <dd className="mt-1 text-sm font-semibold text-body">
                        {formatoUSD(vista.totalPagadoUSD)}
                        <span className="ml-1 font-normal text-muted">
                            ({formatoLocal(vista.totalPagadoLocal, vista.monedaLocal)})
                        </span>
                    </dd>
                </div>
            </dl>

            {vista.esFreemium && (
                <p className="mt-4 rounded-xl bg-cielo/10 px-4 py-2 text-xs font-medium text-cielo">
                    Estás en el periodo gratuito de bienvenida.
                </p>
            )}
        </GlassCard>
    );
}
