/**
 * SPEC-408 · Ficha de verificación (server) → client con el checklist form.
 * Datos cargados server-side + audit al abrir (`PROFESIONAL_VERIFICACION_CONSULTADO`).
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { abrirFicha } from "@/lib/profesionales/verificador/service";
import { logAudit } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { FichaVerificacionClient } from "@/components/modules/verificacion/FichaVerificacionClient";

export const dynamic = "force-dynamic";

export default async function FichaPage({ params }: { params: Promise<{ id: string }> }) {
    const acceso = await verificarAccesoPagina("admin_verificacion_profesionales");
    if (!acceso.permitido) return <SinAccesoModulo />;
    const { id } = await params;
    const user = await verifyAuth();
    const ficha = await abrirFicha(id);
    await logAudit({
        usuarioId: user.id,
        accion: "PROFESIONAL_VERIFICACION_CONSULTADO",
        tipoRecurso: "PerfilProfesional",
        recursoId: id,
    });
    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <Link
                href="/dashboard/admin/verificacion"
                className="inline-flex items-center gap-1 text-sm text-subtle hover:text-body transition"
            >
                ← Volver a la cola
            </Link>
            <FichaVerificacionClient ficha={ficha} />
        </div>
    );
}
