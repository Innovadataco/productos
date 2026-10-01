/**
 * SPEC-408 · Cola 1 del Verificador · página del dashboard admin.
 * Gate por módulo `admin_verificacion_profesionales`.
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { VerificacionColasClient } from "@/components/modules/verificacion/VerificacionColasClient";

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
                    Dos colas: <strong>solicitudes nuevas</strong> de psicólogos esperando entrar, y
                    {" "}<strong>documentos nuevos</strong> de quienes ya atienden. Abrí una para revisar.
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
            <VerificacionColasClient />
        </div>
    );
}
