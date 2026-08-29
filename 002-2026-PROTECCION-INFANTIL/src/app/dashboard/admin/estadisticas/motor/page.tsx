import { Suspense } from "react";
import { DerivaProdBloque } from "@/components/modules/motor/DerivaProdBloque";
import { EstadisticasSubNav } from "../components/EstadisticasSubNav";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

/**
 * SPEC-172 (Pilar D.5) — Motor en producción: deriva frente al banco curado.
 * SPEC-179 (I-59): accesible desde el sub-nav del área de estadísticas.
 */
export default async function AdminEstadisticasMotorPage() {
    const acceso = await verificarAccesoPagina("estadisticas");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Suspense: EstadisticasSubNav lee el tab activo con useSearchParams */}
            <Suspense fallback={null}>
                <EstadisticasSubNav />
            </Suspense>
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Motor</h1>
                <p className="text-sm text-muted">Salud del modelo de clasificación frente al banco curado.</p>
            </div>
            <DerivaProdBloque />
        </div>
    );
}
