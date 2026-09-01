/**
 * SPEC-341 (T035 · FR-024/026) — el banner "estamos generando" con posición
 * REAL en la fila + estimado + aviso "hay N hechos nuevos" cuando aplica.
 *
 * UX de primera clase (mockup ExpedienteGenerando aprobado): esta pieza es
 * lo primero que ve el padre cuando abre un expediente y la capa 1 aún se
 * está interpretando. No es placeholder — es información honesta.
 */
"use client";

interface Props {
    posicionEnFila: number;
    estimadoSeg: number;
    hechosNuevosDesde: number;
}

function formatearEstimado(seg: number): string {
    if (seg < 60) return `${Math.max(1, Math.round(seg))} s`;
    const min = Math.round(seg / 60);
    return `~${min} ${min === 1 ? "minuto" : "minutos"}`;
}

export function ExpedienteGenerando({ posicionEnFila, estimadoSeg, hechosNuevosDesde }: Props) {
    const enFila = posicionEnFila > 1;
    return (
        <div className="rounded-2xl border border-madera/30 bg-madera/10 p-4 text-sm text-body">
            <p className="font-medium">
                Estamos generando tu análisis con lo más reciente
            </p>
            <p className="mt-1 text-muted">
                {enFila
                    ? `Hay ${posicionEnFila - 1} antes en la fila. Estará en ${formatearEstimado(estimadoSeg)}.`
                    : `Estará en ${formatearEstimado(estimadoSeg)}. Puedes navegar y volver — se actualiza solo.`}
            </p>
            {hechosNuevosDesde > 0 && (
                <p className="mt-2 text-xs text-muted">
                    Se están incluyendo {hechosNuevosDesde}{" "}
                    {hechosNuevosDesde === 1 ? "hecho nuevo" : "hechos nuevos"} desde el último análisis.
                </p>
            )}
        </div>
    );
}
