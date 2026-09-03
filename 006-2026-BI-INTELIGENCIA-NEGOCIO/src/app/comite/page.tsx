import Topbar from "@/components/bi/Topbar";
import { getComite } from "@/lib/bi/comite";
import GridKpisComite from "@/components/bi/comite/GridKpisComite";
import BannerAccionComite from "@/components/bi/comite/BannerAccionComite";
import EmbudoComite from "@/components/bi/comite/EmbudoComite";
import SemanaComite from "@/components/bi/comite/SemanaComite";
import TablasComite from "@/components/bi/comite/TablasComite";

// Datos vivos de la réplica en cada request: jamás prerender estático.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Comité (Lote B · 2026-09-03): escalamientos, resolución y tiempos sobre la
 * réplica read-only de PI — SolicitudComite, TransicionReporte y
 * AlertaColegio. Las apelaciones (Ley 1581) NO se replican por decisión de
 * gobierno: esta página mide la operación del comité, no las disputas.
 * Candados 9 y 10: cada cifra del ResultSet y cada sección dice su vacío.
 */
export default async function ComitePage() {
    const comite = await getComite();

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar
                titulo="Comité ·"
                acento="escalamientos y SLA"
                activo="comite"
                sub="Solicitudes, resoluciones y tiempos — fuente: réplica de PI"
            />

            <BannerAccionComite data={comite} />
            <GridKpisComite data={comite} />

            <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1.4fr]">
                <EmbudoComite data={comite} />
                <SemanaComite data={comite} />
            </div>

            <TablasComite data={comite} />
        </main>
    );
}
