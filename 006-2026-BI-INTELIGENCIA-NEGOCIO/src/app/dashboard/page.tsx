import Topbar from "@/components/bi/Topbar";
import { getPulso } from "@/lib/bi/pulso";
import { getInsights } from "@/lib/bi/insights";
import TickerVivo from "@/components/bi/pulso/TickerVivo";
import HeroPulso from "@/components/bi/pulso/HeroPulso";
import SeccionInsights from "@/components/bi/pulso/SeccionInsights";
import GridKpis from "@/components/bi/pulso/GridKpis";
import GridKpisSecundario from "@/components/bi/pulso/GridKpisSecundario";
import GraficoBarras from "@/components/bi/pulso/GraficoBarras";
import GraficoDonut from "@/components/bi/pulso/GraficoDonut";
import SplitAnonimato from "@/components/bi/pulso/SplitAnonimato";
import BarrasEstadosReporte from "@/components/bi/pulso/BarrasEstadosReporte";
import TarjetaComercial from "@/components/bi/pulso/TarjetaComercial";

// Los datos vienen de la réplica en CADA request: jamás prerender estático
// (Prisma corre en runtime Node, no en edge ni en build).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pulso (mockup-bi-v3 · pantalla 1) con datos REALES de la réplica de PI.
 * Server Component: trae todo con getPulso() + getInsights() (contratos de
 * la capa de datos) y compone secciones server; la única isla client es
 * CifraAnimada (count-up con requestAnimationFrame).
 *
 * Candado 9: hayDatos=false apaga KPIs y gráficas — el vacío se dice en el
 * hero, no se disfraza de ceros; dentro de cada tarjeta, un hueco parcial
 * (sin alertas, sin estados, sin suscripciones) se muestra como "aún sin
 * datos". Candado 10: toda cifra renderizada salió de PulsoData/Insight;
 * esta página no calcula métricas.
 */
export default async function DashboardPage() {
    const [pulso, insights] = await Promise.all([getPulso(), getInsights()]);
    const enAtencion = insights.some((i) => i.severidad === "ambar");

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar titulo="Pulso de la" acento="operación" activo="dashboard" />

            <TickerVivo items={pulso.ticker} />

            <HeroPulso
                hayDatos={pulso.hayDatos}
                enAtencion={enAtencion}
                reportesHoy={pulso.kpis.reportesHoy}
                ultimoReporteHaceMin={pulso.ultimoReporteHaceMin}
                saludOperativa={pulso.saludOperativa}
                alertasEscaladas={pulso.alertas.escaladas}
            />

            <SeccionInsights insights={insights} />

            {pulso.hayDatos && (
                <>
                    <GridKpis kpis={pulso.kpis} serieDiaria={pulso.serieDiaria} />
                    <GridKpisSecundario
                        alertas={pulso.alertas}
                        colegiosActivos={pulso.kpis.colegiosActivos}
                        comercial={pulso.comercial}
                        coberturaClasificacionPct={pulso.coberturaClasificacionPct}
                        sinClasificar={pulso.sinClasificar}
                    />
                    <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                        <GraficoBarras serie={pulso.serieDiaria} />
                        <GraficoDonut categorias={pulso.porCategoria} totalMes={pulso.kpis.reportesMes} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-3">
                        <SplitAnonimato anonimato={pulso.anonimato} />
                        <BarrasEstadosReporte estados={pulso.estadosReporte} />
                        <TarjetaComercial comercial={pulso.comercial} />
                    </div>
                </>
            )}
        </main>
    );
}
