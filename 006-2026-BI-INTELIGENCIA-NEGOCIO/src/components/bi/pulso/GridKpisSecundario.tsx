import type { PulsoData } from "@/lib/bi/pulso";
import TarjetaKpi, { type DeltaKpi } from "./TarjetaKpi";
import { fmtMiles } from "./formatos";

/** Delta del KPI de alertas: "N escaladas · M nuevas"; sin alertas → vacío honesto. */
function deltaAlertas(alertas: PulsoData["alertas"]): DeltaKpi {
    if (alertas.total === 0) return { texto: "aún sin alertas en la réplica", tipo: "flat" };
    return {
        texto: `${fmtMiles(alertas.escaladas)} escaladas · ${fmtMiles(alertas.nuevas)} nuevas`,
        tipo: alertas.escaladas > 0 ? "warn" : "flat",
    };
}

/**
 * Segunda fila de KPIs del Pulso (mockup v3 pantalla 1): alertas de colegio,
 * colegios activos (con delta real de suscripciones del contrato comercial)
 * y cobertura del clasificador. Toda cifra sale de PulsoData (candado 10);
 * cobertura null → "—" y "sin datos", jamás un 100% disfrazado (candado 9).
 */
export default function GridKpisSecundario({
    alertas,
    colegiosActivos,
    comercial,
    coberturaClasificacionPct,
    sinClasificar,
}: {
    alertas: PulsoData["alertas"];
    colegiosActivos: number;
    comercial: PulsoData["comercial"];
    coberturaClasificacionPct: number | null;
    sinClasificar: number;
}) {
    return (
        <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Alertas de colegio"
                valor={alertas.total}
                delta={deltaAlertas(alertas)}
                retardo={600}
            />
            <TarjetaKpi
                etiqueta="Colegios activos"
                valor={colegiosActivos}
                delta={
                    comercial.colegiosActivos > 0
                        ? {
                              texto: `${fmtMiles(comercial.colegiosActivos)} con suscripción activa`,
                              tipo: "up",
                          }
                        : { texto: "sin suscripciones registradas", tipo: "flat" }
                }
                retardo={660}
            />
            <TarjetaKpi
                etiqueta="Cobertura clasificación"
                valor={coberturaClasificacionPct}
                decimales={1}
                unidad="%"
                delta={
                    coberturaClasificacionPct === null
                        ? { texto: "sin datos", tipo: "flat" }
                        : sinClasificar > 0
                          ? {
                                texto: `${fmtMiles(sinClasificar)} ${sinClasificar === 1 ? "reporte sin clasificar" : "reportes sin clasificar"}`,
                                tipo: "flat",
                            }
                          : { texto: "todo el histórico clasificado", tipo: "up" }
                }
                retardo={720}
            />
        </div>
    );
}
