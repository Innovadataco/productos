import Topbar from "@/components/bi/Topbar";
import { getGeo } from "@/lib/bi/geo";
import TarjetaMapa from "@/components/bi/geo/TarjetaMapa";
import BarrasTopCiudades from "@/components/bi/geo/BarrasTopCiudades";
import EmbudoReincidencia from "@/components/bi/geo/EmbudoReincidencia";
import { BarrasEstacionalidad, BarrasPorMes } from "@/components/bi/geo/BarrasCronologia";

// Datos vivos de la réplica en cada request: jamás prerender estático.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Geografía y reincidencia (mockup v3 pantalla 3): dónde pasa la operación
 * y quién repite — patrones agregados, no personas. El mapa es client-only
 * (react-leaflet vía dynamic import ssr:false).
 *
 * Candado 9: cada tarjeta dice su vacío con texto honesto; la reincidencia
 * con base delgada (fuente 'honesto_vacio') se anuncia en vez de inflarse.
 * Candado 10: toda cifra sale de GeoData; esta página no calcula métricas.
 */
export default async function GeografiaPage() {
    const geo = await getGeo();

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar titulo="Geografía y" acento="reincidencia" activo="geografia" />

            <TarjetaMapa topCiudades={geo.topCiudades} ciudadesConReportes={geo.ciudadesConReportes} />

            <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <BarrasTopCiudades
                    topCiudades={geo.topCiudades}
                    ciudadesConReportes={geo.ciudadesConReportes}
                    paisesConReportes={geo.paisesConReportes}
                />
                <EmbudoReincidencia reincidencia={geo.reincidencia} />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <BarrasEstacionalidad estacionalidadDow={geo.estacionalidadDow} />
                <BarrasPorMes porMes={geo.porMes} />
            </div>
        </main>
    );
}
