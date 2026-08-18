import { DerivaProdBloque } from "@/components/modules/motor/DerivaProdBloque";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";

/**
 * SPEC-172 (Pilar D.5) — Motor en producción: deriva frente al banco curado.
 * Sin item en el menú admin a propósito en esta fase: se entra por URL desde
 * el área de estadísticas (no hay subnav propio del área donde registrarlo).
 */
export default async function AdminEstadisticasMotorPage() {
    const acceso = await verificarAccesoPagina("estadisticas");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-6xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Motor</h1>
                <p className="text-sm text-muted">Salud del modelo de clasificación frente al banco curado.</p>
            </div>
            <DerivaProdBloque />
        </div>
    );
}
