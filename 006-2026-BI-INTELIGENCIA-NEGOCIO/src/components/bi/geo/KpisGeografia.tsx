import type { GeoData } from "@/lib/bi/geo";
import TarjetaKpi, { type DeltaKpi } from "@/components/bi/pulso/TarjetaKpi";

/**
 * KPIs generales de Geografía (encabezado de la página, pedido del dueño
 * comparando con el dashboard público de PI: "Reportes registrados",
 * "Identificadores visibles", "Reportes autenticados"). Server Component:
 * las cifras vienen tal cual de GeoData.totales; esta tarjeta no calcula
 * nada (candado 10).
 *
 * Candado 9: valor null (sondeo degrado o, en el %, 0 reportes) → la cifra
 * se muestra como "—" con el pie "sin datos": jamás un 0 inventado.
 * No hay comparación con periodo anterior en el contrato → el pie es
 * "sin comparación", no un vs. fabricado.
 */
export default function KpisGeografia({ totales }: { totales: GeoData["totales"] }) {
    const sinDatos: DeltaKpi = { texto: "sin datos", tipo: "flat" };
    const sinComparacion: DeltaKpi = { texto: "sin comparación", tipo: "flat" };
    // Desglose semilla/simulación (CEO 12-09): "N semilla" al lado del total;
    // null (sondeo roto) → se queda el pie neutro, jamás un cero disfrazado.
    const deltaReportes: DeltaKpi =
        totales.reportes !== null && totales.reportesDemo !== null && totales.reportesDemo > 0
            ? { texto: `${totales.reportesDemo.toLocaleString("es-CO")} semilla`, tipo: "flat" }
            : totales.reportes === null
              ? sinDatos
              : sinComparacion;
    return (
        <div className="mb-4 grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(230px,1fr))]">
            <TarjetaKpi
                etiqueta="Reportes registrados"
                valor={totales.reportes}
                delta={deltaReportes}
                retardo={240}
            />
            <TarjetaKpi
                etiqueta="Identificadores visibles"
                valor={totales.identificadoresVisibles}
                delta={totales.identificadoresVisibles === null ? sinDatos : sinComparacion}
                retardo={300}
            />
            <TarjetaKpi
                etiqueta="Reportes autenticados"
                valor={totales.pctAutenticados}
                decimales={0}
                unidad="%"
                delta={totales.pctAutenticados === null ? sinDatos : sinComparacion}
                retardo={360}
            />
        </div>
    );
}
