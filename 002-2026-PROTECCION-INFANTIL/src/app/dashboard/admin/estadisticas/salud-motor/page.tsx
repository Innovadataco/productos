import { Suspense } from "react";
import { EstadisticasSubNav } from "../components/EstadisticasSubNav";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SaludMotorBloque } from "@/components/modules/notificaciones/SaludMotorBloque";

export default async function AdminEstadisticasSaludMotorPage() {
    const acceso = await verificarAccesoPagina("estadisticas_salud_motor");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <Suspense fallback={null}>
                <EstadisticasSubNav />
            </Suspense>
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Salud del motor de notificaciones</h1>
                <p className="text-sm text-muted">Métricas operativas del motor de envíos.</p>
            </div>
            <SaludMotorBloque />
        </div>
    );
}
