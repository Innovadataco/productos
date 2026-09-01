import type { PersonasData } from "@/lib/bi/personas";
import BarrasHorizontales, { type FilaBarraH } from "../pulso/BarrasHorizontales";

/** Estado del enum EstadoAlerta de PI → etiqueta legible. */
const ETIQUETAS_ESTADO_ALERTA: Record<string, string> = {
    NUEVA: "Nuevas",
    VISTA: "Vistas",
    EN_GESTION: "En gestión",
    GESTIONADA: "Gestionadas",
    ESCALADA: "Escaladas",
    CERRADA: "Cerradas",
};

function etiquetaEstado(estado: string): string {
    const clave = estado.toUpperCase().replace(/\s+/g, "_");
    if (ETIQUETAS_ESTADO_ALERTA[clave]) return ETIQUETAS_ESTADO_ALERTA[clave];
    const limpia = estado.replace(/_/g, " ").toLowerCase();
    return limpia.charAt(0).toUpperCase() + limpia.slice(1);
}

/**
 * Estado de las alertas (mockup v3 pantalla 2): ciclo de gestión del colegio
 * en barras horizontales. Las ESCALADAS van en rubí — piden gestión, como en
 * el mockup aprobado. Vacío → nota honesta (candado 9).
 */
export default function BarrasEstadosAlertas({
    alertasPorEstado,
    retardo = 380,
}: {
    alertasPorEstado: PersonasData["alertasPorEstado"];
    retardo?: number;
}) {
    const filas: FilaBarraH[] = alertasPorEstado.map((a) => ({
        etiqueta: etiquetaEstado(a.estado),
        total: a.total,
        acento: a.estado.toUpperCase().replace(/\s+/g, "_") === "ESCALADA" ? "rubi" : undefined,
    }));
    return (
        <div
            className="glass anim-entrada p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Estado de las alertas</h3>
            <div className="mb-4 text-[13px] text-muted">Ciclo de gestión del colegio</div>
            {filas.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún no hay alertas para contar por estado.
                </p>
            ) : (
                <BarrasHorizontales filas={filas} retardoBase={retardo} />
            )}
        </div>
    );
}
