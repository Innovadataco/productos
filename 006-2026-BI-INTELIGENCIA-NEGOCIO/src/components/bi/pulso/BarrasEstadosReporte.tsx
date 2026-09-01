import type { PulsoData } from "@/lib/bi/pulso";
import BarrasHorizontales, { type FilaBarraH } from "./BarrasHorizontales";

/** Estado del enum EstadoReporte de PI → etiqueta legible. */
const ETIQUETAS_ESTADO: Record<string, string> = {
    CLASIFICADO: "Clasificados",
    CORREGIDO: "Corregidos",
    REVISION_MANUAL: "Revisión manual",
    POSIBLE_SPAM: "Posible spam",
    DUPLICADO: "Duplicados",
    REQUIERE_ANONIMIZACION: "Requiere anonimización",
    PENDIENTE: "Pendientes",
    PROCESANDO: "Procesando",
};

function etiquetaEstado(estado: string): string {
    if (ETIQUETAS_ESTADO[estado]) return ETIQUETAS_ESTADO[estado];
    const limpia = estado.replace(/_/g, " ").toLowerCase();
    return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/**
 * Estado de reportes (mockup v3 pantalla 1): ciclo de vida del histórico en
 * barras horizontales. La capa de datos trae {estado, total} ya ordenados;
 * aquí solo se les da etiqueta. Vacío → nota honesta, nunca filas en 0
 * inventadas (candado 9).
 */
export default function BarrasEstadosReporte({
    estados,
    retardo = 840,
}: {
    estados: PulsoData["estadosReporte"];
    retardo?: number;
}) {
    const filas: FilaBarraH[] = estados.map((e) => ({
        etiqueta: etiquetaEstado(e.estado),
        total: e.total,
    }));
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Estado de reportes</h3>
            <div className="mb-4 text-[13px] text-muted">Ciclo de vida del histórico replicado</div>
            {filas.length === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-muted">
                    Aún no hay reportes replicados para contar por estado.
                </p>
            ) : (
                <BarrasHorizontales filas={filas} retardoBase={retardo} />
            )}
        </div>
    );
}
