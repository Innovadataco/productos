import Topbar from "@/components/bi/Topbar";
import { getPersonas } from "@/lib/bi/personas";
import GridKpisPersonas from "@/components/bi/personas/GridKpisPersonas";
import DonutAlertasSujeto from "@/components/bi/personas/DonutAlertasSujeto";
import BarrasEstadosAlertas from "@/components/bi/personas/BarrasEstadosAlertas";
import EmbudoCirculo from "@/components/bi/personas/EmbudoCirculo";
import PlataformasIdentificadores from "@/components/bi/personas/PlataformasIdentificadores";

// Datos vivos de la réplica en cada request: jamás prerender estático.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Personas y vigilados (mockup v3 pantalla 2): quiénes son los actores de la
 * operación — SIN PII, solo patrones agregados (la réplica no trae nombres
 * ni valores de identificadores; eso quedó cortado en origen, Ley 1581).
 *
 * Candado 9: cada tarjeta dice su vacío con texto honesto ("aún sin
 * datos") en vez de disfrazar ceros. Candado 10: toda cifra sale de
 * PersonasData; esta página no calcula métricas.
 */
export default async function PersonasPage() {
    const personas = await getPersonas();

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar titulo="Personas y" acento="vigilados" activo="personas" />

            <GridKpisPersonas personas={personas} />

            <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <DonutAlertasSujeto alertasPorSujeto={personas.alertasPorSujeto} />
                <BarrasEstadosAlertas alertasPorEstado={personas.alertasPorEstado} />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
                <EmbudoCirculo circulo={personas.circulo} />
                <PlataformasIdentificadores
                    identificadoresPorPlataforma={personas.identificadoresPorPlataforma}
                />
            </div>
        </main>
    );
}
