import type { ComercialData } from "@/lib/bi/comercial";
import TarjetaKpi from "../pulso/TarjetaKpi";
import TarjetaKpiDinero from "../pulso/TarjetaKpiDinero";
import { fmtMiles } from "../pulso/formatos";

/**
 * Grid de KPIs de Comercial (Lote A): recaudo mes/año en COP, suscripciones
 * por estado, freemium y conversión, pagos pendientes de autorización. Todo
 * sale de ComercialData; los deltas "sin comparación" cuando la capa de datos
 * no trae base (candado 9 — jamás un vs. inventado).
 */
export default function GridKpisComercial({ data }: { data: ComercialData }) {
    const hayBaseMes = data.kpis.recaudoMesAnterior !== null && data.kpis.recaudoMesAnterior > 0;
    const deltaRecaudo =
        data.kpis.recaudoMes !== null && hayBaseMes
            ? {
                  pct:
                      ((data.kpis.recaudoMes - data.kpis.recaudoMesAnterior!) /
                          data.kpis.recaudoMesAnterior!) *
                      100,
              }
            : null;

    return (
        <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpiDinero
                etiqueta="Recaudo del mes"
                valor={data.kpis.recaudoMes}
                delta={
                    deltaRecaudo
                        ? {
                              texto: `${deltaRecaudo.pct >= 0 ? "+" : ""}${deltaRecaudo.pct.toFixed(1).replace(".", ",")}% vs mes previo`,
                              tipo: deltaRecaudo.pct >= 0 ? "up" : "down",
                          }
                        : { texto: "sin comparación disponible", tipo: "flat" }
                }
                retardo={80}
                brilloNuevo
            />
            <TarjetaKpiDinero
                etiqueta="Recaudo del año"
                valor={data.kpis.recaudoAnio}
                delta={{ texto: "altas manuales autorizadas", tipo: "flat" }}
                retardo={140}
            />
            <TarjetaKpi
                etiqueta="Suscripciones activas"
                valor={data.kpis.activas}
                delta={{
                    texto: `${fmtMiles(data.kpis.enGracia)} en gracia · ${fmtMiles(data.kpis.suspendidas)} suspendidas`,
                    tipo: data.kpis.enGracia > 0 ? "warn" : "flat",
                }}
                retardo={200}
            />
            <TarjetaKpi
                etiqueta="Freemium activos"
                valor={data.kpis.freemiumActivos}
                delta={{
                    texto:
                        data.kpis.conversionFreemiumPct !== null
                            ? `conversión a pago ${String(data.kpis.conversionFreemiumPct).replace(".", ",")}%`
                            : "sin pagantes aún — sin conversión",
                    tipo: data.kpis.conversionFreemiumPct !== null ? "up" : "flat",
                }}
                retardo={260}
            />
            <TarjetaKpi
                etiqueta="Pagos por autorizar"
                valor={data.kpis.pagosPendientesAutorizacion}
                delta={{
                    texto:
                        data.kpis.pagosPendientesAutorizacion > 0
                            ? "renovaciones declaradas esperando visto bueno"
                            : "cola de autorización al día",
                    tipo: data.kpis.pagosPendientesAutorizacion > 0 ? "warn" : "flat",
                }}
                retardo={320}
            />
            <TarjetaKpi
                etiqueta="Por vencer · 7 días"
                valor={data.vencimientos.estaSemana}
                delta={{
                    texto: `${fmtMiles(data.vencimientos.freemiumExpiraSemana)} freemium expiran esta semana`,
                    tipo: data.vencimientos.estaSemana > 0 ? "warn" : "flat",
                }}
                retardo={380}
            />
        </div>
    );
}
