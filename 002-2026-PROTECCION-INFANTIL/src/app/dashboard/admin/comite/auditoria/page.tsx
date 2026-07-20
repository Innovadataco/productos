import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { ComiteSubNav } from "../components/ComiteSubNav";
import { AuditLogViewer } from "@/components/modules/AuditLogViewer";
import { COMITE_AUDIT_ACTIONS } from "@/lib/audit-actions";
import type { RolUsuario } from "@prisma/client";

export default async function ComiteAuditoriaPage() {
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as RolUsuario) ?? "COMITE_VALIDACION";

    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Comité de Validación</h1>
                <p className="text-sm text-muted">Auditoría de las acciones realizadas sobre el comité de validación.</p>
            </div>
            <ComiteSubNav rol={rol} />
            <AuditLogViewer
                title="Auditoría del comité"
                subtitle="Registro de acciones sobre el comité y sus integrantes: creación, activación, actualización de integrantes y gestión de credenciales."
                defaultActions={COMITE_AUDIT_ACTIONS}
            />
        </div>
    );
}
