import type { GeoData } from "@/lib/bi/geo";
import MapaDinamico from "./MapaDinamico";
import { fmtMiles } from "../pulso/formatos";

/**
 * Tarjeta del mapa de reportes (mockup v3 pantalla 3 + mapa interactivo).
 * Server Component: decide con honestidad SI hay mapa. La capa de datos solo
 * trae ciudades RESUELTAS con coordenadas; si la lista viene vacía no se
 * pinta un mapa mudo — se dice que el catálogo aún no tiene coordenadas
 * (candado 9). Si hay más ciudades con reportes que puntos pintados, la
 * diferencia se cuenta en texto, nunca se esconde.
 */
export default function TarjetaMapa({
    topCiudades,
    ciudadesConReportes,
    retardo = 60,
}: {
    topCiudades: GeoData["topCiudades"];
    ciudadesConReportes: number;
    retardo?: number;
}) {
    const sinPintar = Math.max(0, ciudadesConReportes - topCiudades.length);
    return (
        <div
            className="glass anim-entrada mb-4 p-6"
            style={{ "--anim-retardo": `${retardo}ms` } as React.CSSProperties}
        >
            <h3 className="mb-1 text-[16.5px] font-semibold">Mapa de reportes</h3>
            <div className="mb-4 text-[13px] text-muted">
                Un punto por ciudad · tamaño y color según volumen del histórico
            </div>
            {topCiudades.length === 0 ? (
                <p className="py-10 text-center text-[13.5px] text-muted">
                    Aún sin datos en el mapa: la réplica no tiene ciudades con coordenadas
                    resueltas. El ranking de abajo conserva el dato en texto.
                </p>
            ) : (
                <>
                    <MapaDinamico ciudades={topCiudades} />
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
