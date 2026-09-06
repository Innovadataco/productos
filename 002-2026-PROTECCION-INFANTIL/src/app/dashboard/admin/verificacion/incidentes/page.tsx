/**
 * SPEC-408 · Cola 2 · Incidentes de citas SIN_CONFIRMAR.
 * Mismo módulo que cola 1 (decisión CEO 15:38 · un rol, una persona, un trabajo).
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { IncidentesColaClient } from "@/components/modules/verificacion/IncidentesColaClient";

export const dynamic = "force-dynamic";

export default async function IncidentesPage() {
    const acceso = await verificarAccesoPagina("admin_verificacion_profesionales");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header className="anim-entrada">
                <p className="microetiqueta">Red de Apoyo · cola 2</p>
                <h1 className="titular-h1 mt-1">Incidentes de citas</h1>
                <p className="cuerpo text-subtle mt-2">
                    Citas que quedaron <em className="palabra-estado">sin confirmar</em>. Revise la traza de códigos
                    y decida caso por caso — reembolsar, reagendar o marcar cerrada.
                </p>
                <div className="mt-4">
                    <Link
                        href="/dashboard/admin/verificacion"
                        className="rounded-full bg-tinta/5 px-4 py-1.5 text-sm font-medium text-body transition hover:bg-tinta/10"
                    >
                        ← Volver a solicitudes por revisar
                    </Link>
                </div>
            </header>
            <IncidentesColaClient />
        </div>
    );
}
