import { KpisDashboardHome } from "@/components/bi/kpis/KpisDashboardHome";
import { BotonPreguntaAlgo } from "@/components/bi/chat/integracion";
import { EstadoSistemaWidget } from "@/components/bi/estado/EstadoSistemaWidget";
import { SupersetLink } from "@/components/bi/dashboards/SupersetLink";

export default function DashboardHomePage() {
    return (
        <section className="space-y-8">
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Home BI</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Panel principal de Inteligencia de Negocio · IDC
                    </p>
                </div>
                {/* SPEC-026 · CTA para el chat NL→SQL */}
                <BotonPreguntaAlgo />
            </header>

            {/* SPEC-025 · KPIs live desde las MVs */}
            <KpisDashboardHome />

            {/* SPEC-027 · estado de servicios + último reporte */}
            <EstadoSistemaWidget />

            {/* SPEC-028 · botones link a dashboards Superset */}
            <SupersetLink />
        </section>
    );
}
