import { ReporteWizard } from "@/components/modules/ReporteWizard";
import { CanalesOficiales } from "@/components/modules/CanalesOficiales";

export default function ReportarPage() {
    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    Nuevo reporte
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                    Completa los siguientes pasos para registrar tu reporte.
                </p>
            </div>

            <ReporteWizard />
            <CanalesOficiales />
        </main>
    );
}