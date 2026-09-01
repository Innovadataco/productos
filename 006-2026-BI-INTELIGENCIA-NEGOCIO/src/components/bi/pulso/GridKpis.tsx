import type { PulsoData } from "@/lib/bi/pulso";
import TarjetaKpi, { type DeltaKpi } from "./TarjetaKpi";

/** Delta del mes en %: null → "sin comparación" (candado 9), nunca un vs. inventado. */
function deltaPorcentaje(deltaMesPct: number | null): DeltaKpi {
    if (deltaMesPct === null) return { texto: "sin comparación", tipo: "flat" };
    const v = Math.round(deltaMesPct);
    if (v === 0) return { texto: "igual que el mes pasado", tipo: "flat" };
    return {
        texto: `${v > 0 ? "▲" : "▼"} ${Math.abs(v)}% vs. el mes pasado`,
        tipo: v > 0 ? "up" : "down",
    };
}

/** Delta de horas de clasificación: BAJAR la media es la buena noticia (mockup). */
function deltaHoras(deltaClasificacionH: number | null): DeltaKpi {
    if (deltaClasificacionH === null) return { texto: "sin comparación", tipo: "flat" };
    if (deltaClasificacionH === 0) return { texto: "igual que el periodo anterior", tipo: "flat" };
    const mejora = deltaClasificacionH < 0;
    const abs = Math.abs(deltaClasificacionH).toLocaleString("es-CO", { maximumFractionDigits: 1 });
    return {
        texto: `${mejora ? "▼" : "▲"} ${abs} h · ${mejora ? "mejora" : "más lenta"}`,
        tipo: mejora ? "up" : "warn",
    };
}

/**
 * Primera fila de KPIs vivos del Pulso (mockup v3 pantalla 1): reportes del
 * mes, reportes de hoy y media de clasificación. Los números vienen de
 * PulsoData; el sparkline solo aparece en los KPIs de reportes, que tienen
 * serie real (serieDiaria). "Colegios activos" vive en la segunda fila
 * (GridKpisSecundario), donde el contrato v3 le da delta real.
 */
export default function GridKpis({
    kpis,
    serieDiaria,
}: {
    kpis: PulsoData["kpis"];
    serieDiaria: PulsoData["serieDiaria"];
}) {
    const serie = serieDiaria.map((d) => d.total);
    return (
        <div className="mb-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Reportes · este mes"
                valor={kpis.reportesMes}
                delta={deltaPorcentaje(kpis.deltaMesPct)}
                spark={serie}
                retardo={420}
            />
            <TarjetaKpi
                etiqueta="Reportes · hoy"
                valor={kpis.reportesHoy}
                delta={{ texto: "sin comparación", tipo: "flat" }}
                spark={serie}
                retardo={480}
            />
            <TarjetaKpi
                etiqueta="Clasificación media"
                valor={kpis.horasClasificacionMedia}
                decimales={1}
                unidad="h"
                delta={
                    kpis.horasClasificacionMedia === null
                        ? { texto: "sin datos", tipo: "flat" }
                        : deltaHoras(kpis.deltaClasificacionH)
                }
                retardo={540}
            />
        </div>
    );
}
