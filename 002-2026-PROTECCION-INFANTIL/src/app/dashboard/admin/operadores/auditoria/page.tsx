import { OperadoresSubNav } from "../components/OperadoresSubNav";
import { AuditLogViewer } from "@/components/modules/AuditLogViewer";
import { OPERADOR_AUDIT_ACTIONS } from "@/lib/audit-actions";

export default function OperadoresAuditoriaPage() {
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
