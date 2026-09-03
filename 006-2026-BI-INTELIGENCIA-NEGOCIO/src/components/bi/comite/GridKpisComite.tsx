import type { ComiteData } from "@/lib/bi/comite";
import TarjetaKpi from "../pulso/TarjetaKpi";
import { fmtMiles } from "../pulso/formatos";

/**
 * Grid de KPIs de Comité (Lote B): pendientes (con las que llevan +48 h en
 * rubí), resueltas del mes, mediana de horas hasta resolución, % dentro de
 * SLA de 24 h y alertas escaladas abiertas. "sin medición" cuando la réplica
 * no trae base (candado 9).
 */
export default function GridKpisComite({ data }: { data: ComiteData }) {
    return (
        <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Pendientes hoy"
                valor={data.kpis.pendientes}
                delta={{
                    texto:
                        data.kpis.pendientesMas48h > 0
                            ? `${fmtMiles(data.kpis.pendientesMas48h)} llevan más de 48 h`
                            : "ninguna lleva más de 48 h",
                    tipo: data.kpis.pendientesMas48h > 0 ? "down" : "flat",
                }}
                retardo={80}
                brilloNuevo
            />
            <TarjetaKpi
                etiqueta="Resueltas este mes"
                valor={data.kpis.resueltasMes}
                delta={{ texto: "solicitudes cerradas por el comité", tipo: "flat" }}
                retardo={140}
            />
            <TarjetaKpi
                etiqueta="Mediana de resolución"
                valor={data.kpis.medianaHoras}
                decimales={1}
                unidad="h"
                delta={{
                    texto: data.kpis.medianaHoras !== null ? "de creada a resuelta" : "sin resoluciones registradas",
                    tipo: "flat",
                }}
                retardo={200}
            />
            <TarjetaKpi
                etiqueta="Dentro de SLA · 24 h"
                valor={data.kpis.dentroSlaPct}
                decimales={1}
                unidad="%"
                delta={{
                    texto:
                        data.kpis.dentroSlaPct !== null
                            ? "de las resueltas en el mes"
                            : "sin resoluciones en el mes",
                    tipo:
                        data.kpis.dentroSlaPct !== null && data.kpis.dentroSlaPct < 80
                            ? "warn"
                            : "flat",
                }}
                retardo={260}
            />
            <TarjetaKpi
                etiqueta="Alertas escaladas abiertas"
                valor={data.kpis.alertasEscaladasAbiertas}
                delta={{
                    texto:
                        data.kpis.alertasEscaladasAbiertas > 0
                            ? "de colegios esperando gestión"
                            : "sin escaladas abiertas",
                    tipo: data.kpis.alertasEscaladasAbiertas > 0 ? "warn" : "flat",
                }}
                retardo={320}
            />
        </div>
    );
}
