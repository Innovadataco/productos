import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import GuiasAccionAdminClient from "@/components/modules/guias-accion/GuiasAccionAdminClient";

export default async function AdminConfiguracionGuiasAccionPage() {
    const acceso = await verificarAccesoPagina("guias_accion_admin");
    if (!acceso.permitido) return <SinAccesoModulo />;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-body">Guías de acción</h1>
                <p className="text-sm text-muted">
                    Edite, envíe al comité y previsualice las guías de acción que los usuarios verán según la categoría del reporte.
                </p>
            </div>
            <GuiasAccionAdminClient />
        </div>
    );
}
