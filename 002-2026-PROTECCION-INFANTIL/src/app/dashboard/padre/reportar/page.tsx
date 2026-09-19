import { ReporteWizard } from "@/components/modules/ReporteWizard";
import { exigirPadre } from "@/lib/padre/guardia-padre";

/**
 * SPEC-295 (002-PI-196 · cierra I-146): página real del padre autenticado
 * para reportar. Reutiliza `ReporteWizard` con `modoAutenticado` — el mismo
 * componente que la ruta pública `/reportar`, con banner de identidad y
 * redirect a `/dashboard/padre/mis-reportes` post-envío.
 */
export default async function PadreReportarPage() {
    await exigirPadre(); // SPEC-711: compuerta por rol (rol ≠ PARENT → su área)
    return (
        <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
            <div className="mb-8 text-center">
                <h1 className="text-2xl font-bold tracking-tight text-tinta sm:text-3xl">
                    Reportar una situación
                </h1>
                <p className="mt-2 text-sm text-muted">
                    Tu identidad quedará vinculada al reporte. Puedes elegir
                    &quot;reportar anónimo&quot; si prefieres que el reporte no aparezca en tu historial.
                </p>
            </div>
            <ReporteWizard modoAutenticado />
        </main>
    );
}
