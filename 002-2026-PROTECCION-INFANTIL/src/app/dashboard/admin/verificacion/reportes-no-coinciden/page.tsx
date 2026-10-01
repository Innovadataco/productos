/**
 * SPEC-787 · Bandeja del verificador · «Reportes que no coinciden» (incidentes de contradicción
 * de encuestas, SPEC-753). Superficie PROPIA (no la cola de verificación de profesionales: otro
 * dominio, otro criterio de orden). Mismo módulo del verificador. 100% interna.
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { ReportesNoCoincidenClient } from "@/components/modules/verificacion/ReportesNoCoincidenClient";

export const dynamic = "force-dynamic";

export default async function ReportesNoCoincidenPage() {
    const acceso = await verificarAccesoPagina("admin_verificacion_profesionales");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header className="anim-entrada">
                <p className="microetiqueta">Verificador · reportes que no coinciden</p>
                <h1 className="titular-h1 mt-1">Reportes que no coinciden</h1>
                <p className="cuerpo text-subtle mt-2">
                    El padre y el profesional respondieron distinto sobre si la cita se realizó. Revise las dos
                    versiones —se muestran igual, sin dar por cierta ninguna— y registre la resolución. El orden
                    es por tiempo de respuesta: lo que vence antes va primero.
                </p>
                <div className="mt-4">
                    <Link
                        href="/dashboard/admin/verificacion"
                        className="rounded-full bg-tinta/5 px-4 py-1.5 text-sm font-medium text-body transition hover:bg-tinta/10"
                    >
                        ← Volver a verificación
                    </Link>
                </div>
            </header>
            <ReportesNoCoincidenClient />
        </div>
    );
}
