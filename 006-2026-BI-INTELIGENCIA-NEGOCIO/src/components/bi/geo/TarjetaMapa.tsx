import type { GeoData } from "@/lib/bi/geo";
import MapaDinamico from "./MapaDinamico";
import { fmtMiles } from "../pulso/formatos";

/**
 * Tarjeta del mapa de calor por ciudad + choropleth de países (mockup v3
 * pantalla 3). Server Component: decide con honestidad SI hay mapa. La capa
 * de datos solo trae ciudades RESUELTAS con coordenadas e intensidad; si la
 * lista viene vacía no se pinta un mapa mudo — se dice que la réplica aún no
 * tiene ciudades con coordenadas (candado 9). Si hay más ciudades con
 * reportes que puntos pintados, la diferencia se cuenta en texto.
 *
 * Bajo el mapa va la leyenda de AMBAS codificaciones (pedido del dueño,
 * como el dashboard público de PI): relleno del polígono = reportes del
 * país (4 bandas pino→cielo→ambar→rubí por fracción del máximo; los
 * países sin reportes conservan el relleno base) y círculo = ciudad (color
 * por cuartil de intensidad, tamaño por total). Sin leyenda el color del
 * país y el del círculo serían ilegibles — comparten paleta pero significan
 * cosas distintas.
 */
export default function TarjetaMapa({
    calorCiudades,
    ciudadesConReportes,
    paises,
    retardo = 60,
}: {
    calorCiudades: GeoData["calorCiudades"];
    ciudadesConReportes: number;
    paises: GeoData["porPais"];
    retardo?: number;
}) {
    const sinPintar = Math.max(0, ciudadesConReportes - calorCiudades.length);
    const hayCoropleta = paises.length > 0;
    return (
        <div
            className="glass anim-entrada mb-4 p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Mapa de reportes</h3>
            <div className="mb-4 text-[13px] text-muted">
                Relleno por país según sus reportes · un círculo por ciudad con su total
            </div>
            {calorCiudades.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún sin datos en el mapa: la réplica no tiene ciudades con coordenadas
                    resueltas. El ranking de abajo conserva el dato en texto.
                </p>
            ) : (
                <>
                    <MapaDinamico ciudades={calorCiudades} paises={paises} />
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                            <div className="leyenda-calor" />
                            <div className="mt-1.5 flex justify-between text-[11px] text-subtle">
                                <span>Menor intensidad</span>
                                <span>Mayor intensidad</span>
                            </div>
                            <p className="mt-1 text-[11.5px] text-subtle">
                                Círculo = ciudad: color por cuartil de intensidad, tamaño
                                proporcional al total de reportes.
                            </p>
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtle">
                                <span
                                    className="inline-block h-3 w-3 rounded-sm"
                                    style={{ background: "rgb(242 247 244 / 0.07)" }}
                                />
                                <span>sin reportes</span>
                                <span
                                    className="ml-2 inline-block h-3 w-3 rounded-sm"
                                    style={{ background: "rgb(var(--pino-rgb))" }}
                                />
                                <span>&lt; 25% del máximo</span>
                                <span
                                    className="ml-2 inline-block h-3 w-3 rounded-sm"
                                    style={{ background: "rgb(var(--cielo-rgb))" }}
                                />
                                <span>&lt; 50%</span>
                                <span
                                    className="ml-2 inline-block h-3 w-3 rounded-sm"
                                    style={{ background: "rgb(var(--ambar-rgb))" }}
                                />
                                <span>&lt; 75%</span>
                                <span
                                    className="ml-2 inline-block h-3 w-3 rounded-sm"
                                    style={{ background: "rgb(var(--rubi-rgb))" }}
                                />
                                <span>≥ 75%</span>
                            </div>
                            <p className="mt-1 text-[11.5px] text-subtle">
                                Relleno = reportes del país (4 bandas respecto al país líder).
                            </p>
                        </div>
                    </div>
                    {!hayCoropleta && (
                        <p className="mt-3 text-[12.5px] text-muted">
                            Sin datos de relleno por país: la consulta de países no respondió
                            o ningún reporte tiene país resuelto en el catálogo.
                        </p>
                    )}
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
