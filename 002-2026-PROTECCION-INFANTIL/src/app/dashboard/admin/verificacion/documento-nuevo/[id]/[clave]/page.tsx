/**
 * SPEC-693 (I-416) · Pantalla «documento nuevo» (server) → client de comparar.
 * `id` = perfil profesional; `clave` = requisito. Carga la comparación server-side y
 * audita la apertura. Si ya no hay documento nuevo (otro lo decidió) o el requisito no
 * tiene vigente, muestra el motivo y ofrece volver — no un error crudo (FORMA §5).
 */
import Link from "next/link";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { SinAccesoModulo } from "@/components/modules/SinAccesoModulo";
import { abrirDocumentoNuevo } from "@/lib/profesionales/verificador/renovacion";
import { logAudit } from "@/lib/audit";
import { verifyAuth } from "@/lib/auth";
import { DocumentoNuevoClient } from "@/components/modules/verificacion/DocumentoNuevoClient";

export const dynamic = "force-dynamic";

export default async function DocumentoNuevoPage({
    params,
}: {
    params: Promise<{ id: string; clave: string }>;
}) {
    const acceso = await verificarAccesoPagina("admin_verificacion_profesionales");
    if (!acceso.permitido) return <SinAccesoModulo />;
    const { id, clave } = await params;
    const user = await verifyAuth();

    let data;
    try {
        data = await abrirDocumentoNuevo(id, clave);
    } catch (e) {
        const texto = e instanceof Error ? e.message : "No se pudo abrir el documento.";
        return (
            <div className="mx-auto max-w-4xl space-y-4">
                <Link
                    href="/dashboard/admin/verificacion"
                    className="inline-flex items-center gap-1 text-sm text-subtle hover:text-body transition"
                >
                    ← Volver a la cola
                </Link>
                <div className="glass rounded-3xl p-8 text-center">
                    <p className="titular-seccion mb-2">Este documento ya no está para revisar</p>
                    <p className="cuerpo text-subtle">{texto}</p>
                </div>
            </div>
        );
    }

    await logAudit({
        usuarioId: user.id,
        accion: "PROFESIONAL_VERIFICACION_CONSULTADO",
        tipoRecurso: "PerfilProfesional",
        recursoId: id,
        metadatos: { documentoNuevo: clave },
    });

    return (
        <div className="mx-auto max-w-4xl space-y-4">
            <Link
                href="/dashboard/admin/verificacion"
                className="inline-flex items-center gap-1 text-sm text-subtle hover:text-body transition"
            >
                ← Volver a la cola
            </Link>
            <DocumentoNuevoClient data={data} />
        </div>
    );
}
