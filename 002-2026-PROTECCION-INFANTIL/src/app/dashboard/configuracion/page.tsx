import ConfigPanel from "@/components/modules/ConfigPanel";

export default function ConfiguracionPage() {
    return (
        <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Configuración del Sistema</h1>
                <p className="mt-1 text-sm text-slate-500">
                    Editá los parámetros que controlan el scoring, visibilidad pública, alertas y límites.
                </p>
            </div>
            <ConfigPanel />
        </main>
    );
}
