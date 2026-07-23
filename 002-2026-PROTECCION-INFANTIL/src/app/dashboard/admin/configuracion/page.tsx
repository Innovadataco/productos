import { ConfiguracionTabs } from "@/components/modules/ConfiguracionTabs";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

export default async function AdminConfiguracionPage() {
    const acceso = await verificarAccesoPagina("configuracion_sistema");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-5xl">
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-body">Configuración del sistema</h1>
                <p className="text-sm text-muted">
                    Editá los parámetros que controlan el scoring, visibilidad pública, alertas y límites. Los cambios se aplican de inmediato.
                </p>
            </div>
            <ConfiguracionTabs />
        </div>
    );
}
