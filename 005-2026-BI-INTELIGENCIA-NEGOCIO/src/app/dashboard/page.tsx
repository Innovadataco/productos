export default function DashboardHomePage() {
    return (
        <section className="space-y-6">
            <header>
                <h1 className="text-2xl font-bold text-slate-900">Home BI</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Panel principal de Inteligencia de Negocio · IDC
                </p>
            </header>
            <div className="rounded-lg border border-dashed border-slate-300 bg-white/60 p-6 text-sm text-slate-500">
                <p className="font-semibold text-slate-700">Contenido pendiente</p>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                    <li>KPIs live se muestran cuando SPEC-025 se despliegue.</li>
                    <li>Widget de estado sistema en SPEC-027.</li>
                    <li>Botones a dashboards Superset en SPEC-028.</li>
                </ul>
            </div>
        </section>
    );
}
