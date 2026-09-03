import Topbar from "@/components/bi/Topbar";
import { getComercial } from "@/lib/bi/comercial";
import GridKpisComercial from "@/components/bi/comercial/GridKpisComercial";
import BannerAccionComercial from "@/components/bi/comercial/BannerAccionComercial";
import EmbudoComercial from "@/components/bi/comercial/EmbudoComercial";
import RecaudoMensual from "@/components/bi/comercial/RecaudoMensual";
import RecaudoMetodo from "@/components/bi/comercial/RecaudoMetodo";
import TablasComercial from "@/components/bi/comercial/TablasComercial";

// Datos vivos de la réplica en cada request: jamás prerender estático.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Comercial (Lote A · 2026-09-03): plata y operación de cobro sobre la réplica
 * read-only de PI — Suscripcion, Pago, Plan y Colegio. Bonos y referidos
 * FUERA de alcance por orden expresa (módulo en desarrollo en PI). Nombres de
 * colegio en claro solo para el CEO (ARQ_07). Candados 9 y 10: cada cifra del
 * ResultSet y cada sección dice su vacío.
 */
export default async function ComercialPage() {
    const comercial = await getComercial();

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar
                titulo="Comercial ·"
                acento="plata y cobro"
                activo="comercial"
                sub="Suscripciones, recaudo y vencimientos — fuente: réplica de PI"
            />

            <BannerAccionComercial data={comercial} />
            <GridKpisComercial data={comercial} />

            <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <RecaudoMensual data={comercial} />
                <RecaudoMetodo data={comercial} />
            </div>

            <div className="mb-4">
                <EmbudoComercial data={comercial} />
            </div>

            <TablasComercial data={comercial} />
        </main>
    );
}
