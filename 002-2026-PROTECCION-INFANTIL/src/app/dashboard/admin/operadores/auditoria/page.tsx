import { redirect } from "next/navigation";
import { verificarAccesoPagina } from "@/lib/permisos-modulos";
import { homeAccesoDenegado } from "../acceso-denegado";
import { OperadoresSubNav } from "../components/OperadoresSubNav";
import { AuditLogViewer } from "@/components/modules/AuditLogViewer";
import { OPERADOR_AUDIT_ACTIONS } from "@/lib/audit-actions";

/**
 * SPEC-571 (I-353): guardia A NIVEL PÁGINA que ESPEJA EL PAR de su API. Este
 * mismo PR le agregó verifyAuth("ADMIN") a /api/admin/audit-logs (antes era
 * módulo-solo), así que su handler ahora hace ADMIN + assertModulo("audit_logs")
 * y el espejo fiel es el par: rol ADMIN + módulo "audit_logs" (su dato, NO
 * "operadores" — así no deja afuera a un admin con auditoría pero sin gestión).
 * Hoy audit_logs es mono-rol y el módulo solo coincidiría, pero se espeja lo que
 * la API HACE, no lo que hoy alcanza. Denegado redirige como el área (I-129).
 */
export default async function OperadoresAuditoriaPage() {
    const acceso = await verificarAccesoPagina("audit_logs");
    if (!acceso.permitido || acceso.rol !== "ADMIN") redirect(homeAccesoDenegado(acceso.rol));
    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Operadores de casos</h1>
                <p className="text-sm text-muted">Auditoría de las acciones realizadas sobre operadores.</p>
            </div>
            <OperadoresSubNav />
            <AuditLogViewer
                title="Auditoría de operadores"
                subtitle="Registro de acciones sobre operadores: creación, activación, asignación, reasignación y gestión de credenciales."
                defaultActions={OPERADOR_AUDIT_ACTIONS}
            />
        </div>
    );
}
