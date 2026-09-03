/**
 * SPEC-408 · Cola 1 del Verificador · página del dashboard admin.
 * Gate por módulo `admin_verificacion_profesionales`.
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { VerificacionColaClient } from "@/components/modules/verificacion/VerificacionColaClient";

export const dynamic = "force-dynamic";

export default async function VerificacionPage() {
    const acceso = await verificarAccesoPagina("admin_verificacion_profesionales");
    if (!acceso.permitido) return <SinAccesoModulo />;
    return (
        <div className="mx-auto max-w-4xl space-y-6">
            <header className="anim-entrada">
                <p className="microetiqueta">Red de Apoyo</p>
                <h1 className="titular-h1 mt-1">Verificación de profesionales</h1>
                <p className="cuerpo text-subtle mt-2">
                    Solicitudes de psicólogos esperando revisión. Abrí una para ver los documentos,
                    marcar cada requisito y aprobar o devolver con observaciones.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                    <Link
                        href="/dashboard/admin/verificacion/incidentes"
                        className="rounded-full bg-tinta/5 px-4 py-1.5 font-medium text-body transition hover:bg-tinta/10"
                    >
                        Ver incidentes de citas →
                    </Link>
                </div>
            </header>
            <VerificacionColaClient />
        </div>
    );
}
