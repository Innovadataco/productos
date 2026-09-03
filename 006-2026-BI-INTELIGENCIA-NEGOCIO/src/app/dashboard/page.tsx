import Topbar from "@/components/bi/Topbar";
import { getPulso } from "@/lib/bi/pulso";
import { getInsights } from "@/lib/bi/insights";
import { getCapacidad } from "@/lib/bi/capacidad";
import { getVigilancia } from "@/lib/bi/vigilancia";
import TickerVivo from "@/components/bi/pulso/TickerVivo";
import HeroPulso from "@/components/bi/pulso/HeroPulso";
import SeccionInsights from "@/components/bi/pulso/SeccionInsights";
import TarjetaCapacidad from "@/components/bi/pulso/TarjetaCapacidad";
import GridKpis from "@/components/bi/pulso/GridKpis";
import GridKpisSecundario from "@/components/bi/pulso/GridKpisSecundario";
import SeccionSemana from "@/components/bi/pulso/SeccionSemana";
import TarjetaSla from "@/components/bi/pulso/TarjetaSla";
import GraficoBarras from "@/components/bi/pulso/GraficoBarras";
import GraficoDonut from "@/components/bi/pulso/GraficoDonut";
import SplitAnonimato from "@/components/bi/pulso/SplitAnonimato";
import BarrasEstadosReporte from "@/components/bi/pulso/BarrasEstadosReporte";
import TarjetaComercial from "@/components/bi/pulso/TarjetaComercial";
import SeccionVigilancia from "@/components/bi/vigilancia/SeccionVigilancia";

// Los datos vienen de la réplica en CADA request: jamás prerender estático
// (Prisma corre en runtime Node, no en edge ni en build).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Pulso (mockup-bi-v3 · pantalla 1) con datos REALES de la réplica de PI.
 * Server Component: trae todo con getPulso() + getInsights() + getCapacidad()
 * + getVigilancia() (contratos de la capa de datos) y compone secciones
 * server; la única isla client es CifraAnimada (count-up con
 * requestAnimationFrame).
 *
 * Candado 9: hayDatos=false apaga KPIs y gráficas — el vacío se dice en el
 * hero, no se disfraza de ceros; dentro de cada tarjeta, un hueco parcial
 * (sin alertas, sin estados, sin suscripciones) se muestra como "aún sin
 * datos". La tarjeta de capacidad operativa y la sección de vigilancia viven
 * FUERA del hayDatos: con cero operarios la brecha es un hecho visible, y un
 * motor frenado o un atasco son señales que importan incluso sin histórico.
 * Candado 10: toda cifra renderizada salió de PulsoData/Insight/
 * CapacidadData/VigilanciaData; esta página no calcula métricas.
 *
 * Pulso siguiente nivel: tras los KPIs van la comparativa "Semana contra
 * semana" y la tarjeta "SLA vencido" (PulsoData.semana / PulsoData.sla).
 * Ambas viven DENTRO del hayDatos: las alertas de colegio nacen de reportes,
 * así que sin histórico un "0 vencidas" sería un cero disfrazado. El criterio
 * del delta (más reportes NO es "mejor": subir es warn; en clasificación
 * media, bajar es la mejora) está documentado en SeccionSemana.
 */
export default async function DashboardPage() {
    const [pulso, insights, capacidad, vigilancia] = await Promise.all([
        getPulso(),
        getInsights(),
        getCapacidad(),
        // La vigilancia degrada sola: si la réplica no responde, la sección
        // lo dice honesto en vez de tumbar el Pulso entero (mismo criterio
        // de degradación por sección que getPulso).
        getVigilancia().catch((error: unknown) => {
            console.warn(
                `[Dashboard] Vigilancia sin datos: la réplica no respondió — ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return null;
        }),
    ]);
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

            {/* Capacidad operativa: FUERA del hayDatos — con réplica vacía o
                con CERO operarios la brecha es un hecho que se muestra, no un
                hueco que se oculta (candado 9). */}
            <TarjetaCapacidad capacidad={capacidad} />

            {/* Vigilancia (marco Lote 1): también FUERA del hayDatos — las
                señales del sistema (motor frenado, atascos, ráfagas) importan
                incluso con la réplica vacía; cada tarjeta dice su vacío
                honesto en vez de desaparecer. */}
            <SeccionVigilancia vigilancia={vigilancia} />

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
                    {/* Pulso siguiente nivel: comparativa semanal + SLA vencido. */}
                    <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                        <SeccionSemana semana={pulso.semana} retardo={780} />
                        <TarjetaSla sla={pulso.sla} retardo={840} />
                    </div>
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
