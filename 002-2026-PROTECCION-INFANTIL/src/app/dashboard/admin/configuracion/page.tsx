import ConfigPanel from "@/components/modules/ConfigPanel";

export default function AdminConfiguracionPage() {
    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Configuración del sistema</h1>
                <p className="text-sm text-slate-500">
                    Editá los parámetros que controlan el scoring, visibilidad pública, alertas y límites. Los cambios se aplican de inmediato.
                </p>
            </div>
            <ConfigPanel />
        </div>
    );
}
