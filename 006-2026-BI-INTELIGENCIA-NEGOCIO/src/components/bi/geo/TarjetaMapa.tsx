import type { GeoData } from "@/lib/bi/geo";
import MapaDinamico from "./MapaDinamico";
import { fmtMiles } from "../pulso/formatos";

/**
 * Tarjeta del mapa de calor por ciudad (Pulso siguiente nivel · mockup v3
 * pantalla 3). Server Component: decide con honestidad SI hay mapa. La capa
 * de datos solo trae ciudades RESUELTAS con coordenadas e intensidad; si la
 * lista viene vacía no se pinta un mapa mudo — se dice que la réplica aún no
 * tiene ciudades con coordenadas (candado 9). Si hay más ciudades con
 * reportes que puntos pintados, la diferencia se cuenta en texto.
 *
 * Bajo el mapa va la leyenda de la escala de calor (pino→cielo→ambar→rubí,
 * cuartiles de intensidad) y la nota de que el tamaño del punto es
 * proporcional al total de reportes: sin leyenda el color sería ilegible.
 */
export default function TarjetaMapa({
    calorCiudades,
    ciudadesConReportes,
    retardo = 60,
}: {
    calorCiudades: GeoData["calorCiudades"];
    ciudadesConReportes: number;
    retardo?: number;
}) {
    const sinPintar = Math.max(0, ciudadesConReportes - calorCiudades.length);
    return (
        <div
            className="glass anim-entrada mb-4 p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Mapa de calor por ciudad</h3>
            <div className="mb-4 text-[13px] text-muted">
                Un punto por ciudad · color por cuartil de intensidad, tamaño por total de
                reportes
            </div>
            {calorCiudades.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún sin datos en el mapa de calor: la réplica no tiene ciudades con
                    coordenadas resueltas. El ranking de abajo conserva el dato en texto.
                </p>
            ) : (
                <>
                    <MapaDinamico ciudades={calorCiudades} />
                    <div className="mt-4">
                        <div className="leyenda-calor" />
                        <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
                            <span>Menor intensidad</span>
                            <span>Mayor intensidad</span>
                        </div>
                        <p className="mt-1 text-[11.5px] text-subtle">
                            Escala por cuartiles: pino · cielo · ámbar · rubí — el tamaño del
                            punto es proporcional al total de reportes.
                        </p>
                    </div>
                    {sinPintar > 0 && (
                        <p className="mt-3 text-[12.5px] text-muted">
                            {fmtMiles(sinPintar)}{" "}
                            {sinPintar === 1 ? "ciudad" : "ciudades"} con reportes no se{" "}
                            {sinPintar === 1 ? "pinta" : "pintan"} por no tener coordenadas
                            resueltas en el catálogo.
                        </p>
                    )}
                </>
            )}
        </div>
    );
}
