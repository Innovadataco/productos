import Topbar from "@/components/bi/Topbar";
import { getAnalitica } from "@/lib/bi/analitica";
import { getReportes360 } from "@/lib/bi/reportes360";
import BandaSigma from "@/components/bi/analitica/BandaSigma";
import ProyeccionSemana from "@/components/bi/analitica/ProyeccionSemana";
import RiesgoCategorias from "@/components/bi/analitica/RiesgoCategorias";
import Reportes360 from "@/components/bi/analitica/Reportes360";
import DetectorFenomenos from "@/components/bi/analitica/DetectorFenomenos";
import FrentePadre from "@/components/bi/analitica/FrentePadre";
import Vencimientos from "@/components/bi/analitica/Vencimientos";
import CronologiaAnual from "@/components/bi/analitica/CronologiaAnual";

// Datos vivos de la réplica en cada request: jamás prerender estático.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Analítica predictiva y proactiva (mockup v4, aprobado por el dueño):
 * qué viene, qué se sale del patrón y qué mirar ya — siempre con evidencia.
 * Secciones en el orden del mockup: banda sigma del día, proyección con rango
 * honesto, riesgo por categoría, Reportes 360 (análisis completo del
 * universo de reportes), detector de fenómenos, frente padre + vencimientos
 * y cronología del año con marcadores de fenómeno.
 *
 * Candado 9: cada sección anuncia su vacío/sin base con texto honesto.
 * Candado 10: toda cifra sale de AnaliticaData / Reportes360Data; esta página
 * no calcula nada.
 */
export default async function AnaliticaPage() {
    const [data, reportes360] = await Promise.all([getAnalitica(), getReportes360()]);

    return (
        <main className="relative z-10 mx-auto max-w-[1180px] px-6 pb-20 pt-8">
            <Topbar
                titulo="Analítica"
                acento="predictiva"
                activo="analitica"
                sub="Qué viene · qué se sale del patrón · qué mirar ya — siempre con evidencia"
            />

            {/* 1 · Anomalía del día (viva) */}
            <BandaSigma anomalia={data.anomaliaHoy} fenomenosActivos={data.fenomenos.length} />

            {/* 2 · Proyección (rango, jamás cifra puntual) + 3 · Riesgo por categoría */}
            <div className="mb-4 grid gap-4 lg:grid-cols-[1.6fr_1fr]">
                <ProyeccionSemana proyeccion={data.proyeccion} />
                <RiesgoCategorias riesgo={data.riesgoCategorias} />
            </div>

            {/* 3.5 · Reportes 360: análisis completo del universo de reportes */}
            <Reportes360 datos={reportes360} />

            {/* 4 · Detector de fenómenos (proactivo — el corazón) */}
            <DetectorFenomenos fenomenos={data.fenomenos} />

            {/* 5 · Frente padre + vencimientos */}
            <div className="mb-4 grid gap-4 lg:grid-cols-2">
                <FrentePadre frente={data.frentePadre} />
                <Vencimientos vencimientos={data.vencimientos} />
            </div>

            {/* 6 · Cronología viva */}
            <CronologiaAnual cronologia={data.cronologia} />
        </main>
    );
}
