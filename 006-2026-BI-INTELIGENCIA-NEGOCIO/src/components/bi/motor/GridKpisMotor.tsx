import type { MotorData } from "@/lib/bi/salud-motor";
import TarjetaKpi from "../pulso/TarjetaKpi";
import { fmtMiles } from "../pulso/formatos";

/**
 * Grid de KPIs del Motor (Lote C): clasificaciones y confianza de las últimas
 * 24 h, corrección humana del mes, latencia de clasificación, cola de
 * procesamiento (con atascados en rubí) y reintentos. "sin medición" cuando la
 * réplica no trae base (candado 9).
 */
export default function GridKpisMotor({ data }: { data: MotorData }) {
    const hayAtascados = data.kpis.atascados > 0;
    return (
        <div className="mb-6 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Clasificaciones · 24 h"
                valor={data.kpis.clasificaciones24h}
                delta={{
                    texto:
                        data.kpis.confianzaMedia24h !== null
                            ? `confianza media ${data.kpis.confianzaMedia24h.toFixed(2).replace(".", ",")}`
                            : "sin clasificaciones en 24 h",
                    tipo: "flat",
                }}
                retardo={140}
            />
            <TarjetaKpi
                etiqueta="Corrección humana · mes"
                valor={data.kpis.correccionMesPct}
                decimales={1}
                unidad="%"
                delta={{
                    texto:
                        data.kpis.correccionMesPct !== null
                            ? "de lo clasificado — insumo del dataset"
                            : "sin clasificaciones en el mes",
                    tipo:
                        data.kpis.correccionMesPct !== null && data.kpis.correccionMesPct > 10
                            ? "warn"
                            : "flat",
                }}
                retardo={200}
                brilloNuevo
            />
            <TarjetaKpi
                etiqueta="Latencia de clasificación"
                valor={data.kpis.latenciaClasificacionMs}
                unidad="ms"
                delta={{
                    texto: data.kpis.latenciaClasificacionMs !== null ? "media · últimos 7 días" : "sin pasos de decisión aún",
                    tipo: "flat",
                }}
                retardo={260}
            />
            <TarjetaKpi
                etiqueta="En cola de procesamiento"
                valor={data.kpis.enCola}
                delta={{
                    texto: hayAtascados
                        ? `${fmtMiles(data.kpis.atascados)} atascados hace más de 10 min`
                        : "sin atascos — flujo al día",
                    tipo: hayAtascados ? "down" : "flat",
                }}
                retardo={320}
            />
            <TarjetaKpi
                etiqueta="Reintentos · 24 h"
                valor={data.kpis.reintentos24h}
                delta={{
                    texto:
                        data.kpis.reintentosFallidos24h > 0
                            ? `${fmtMiles(data.kpis.reintentosFallidos24h)} fallidos — revisar worker`
                            : data.kpis.reintentos24h > 0
                              ? "todos recuperados"
                              : "sin reintentos",
                    tipo: data.kpis.reintentosFallidos24h > 0 ? "warn" : "flat",
                }}
                retardo={380}
            />
        </div>
    );
}
