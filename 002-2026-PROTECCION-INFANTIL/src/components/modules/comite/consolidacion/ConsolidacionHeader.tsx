// SPEC-237 (002-PI-mega-cola): encabezado de la vista de consolidación.
// Identificador, estado, categoría dominante, score y SLA en zona Bogotá.
import { formatearEnBogota } from "@/lib/comite/sla";
import type { DetalleConsolidacionDto } from "./tipos";

const COLOR_DOT: Record<string, string> = {
    pino: "bg-pino",
    ambar: "bg-ambar",
    rubi: "bg-rubi",
};

export function ConsolidacionHeader({ detalle }: { detalle: DetalleConsolidacionDto }) {
    const { expediente, informe } = detalle;
    const sla = expediente.sla;
    return (
        <header className="glass rounded-2xl p-6 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-body font-mono">{expediente.identificadorPrincipal}</h2>
                <span className="rounded-full bg-ambar/10 px-2.5 py-0.5 text-xs font-medium text-ambar">
                    {expediente.estado}
                </span>
                <span className="rounded-full bg-cielo/10 px-2.5 py-0.5 text-xs font-medium text-cielo">
                    Informe: {informe.estadoAprobacion}
                </span>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                    <dt className="text-muted">Categoría dominante</dt>
                    <dd className="text-body">{expediente.categoriaDominante ?? "Sin categoría dominante"}</dd>
                </div>
                <div>
                    <dt className="text-muted">Score de gravedad</dt>
                    <dd className="text-body">{expediente.scoreGravedadActual}</dd>
                </div>
                <div>
                    <dt className="text-muted">Apertura del expediente</dt>
                    <dd className="text-body">{formatearEnBogota(new Date(expediente.fechaApertura))}</dd>
                </div>
                <div>
                    <dt className="text-muted">SLA de consolidación (Bogotá)</dt>
                    <dd className="inline-flex items-center gap-1.5 text-body">
                        <span className={`h-2.5 w-2.5 rounded-full ${COLOR_DOT[sla.color] ?? "bg-pino"}`} aria-hidden />
                        {formatearEnBogota(new Date(sla.fechaLimite))}
                        {sla.vencido ? " · vencido" : ""}
                    </dd>
                </div>
            </dl>
            <p className="text-xs text-muted">
                Aprobaciones del comité: {informe.aprobaciones.length}/{informe.aprobacionesRequeridas}
            </p>
        </header>
    );
}
