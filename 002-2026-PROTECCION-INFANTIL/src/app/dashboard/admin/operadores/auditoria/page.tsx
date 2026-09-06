import { OperadoresSubNav } from "../components/OperadoresSubNav";
import { AuditLogViewer } from "@/components/modules/AuditLogViewer";
import { OPERADOR_AUDIT_ACTIONS } from "@/lib/audit-actions";

export default function OperadoresAuditoriaPage() {
    return (
        <div className="mx-auto max-w-7xl space-y-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Auditoría de operadores</h1>
                <p className="text-sm text-muted">
                    Registro de acciones sobre operadores: creación, activación, asignación,
                    reasignación y gestión de credenciales.
                </p>
            </div>
            <OperadoresSubNav />
            {/* SPEC-573 (fold-in de SPEC-569): el encabezado local de arriba es el ÚNICO — no se
                pasa title/subtitle al viewer, que si los recibe pinta su propio título y duplica el
                encabezado. Diseño: el título de la pantalla es «Auditoría de operadores». */}
            <AuditLogViewer defaultActions={OPERADOR_AUDIT_ACTIONS} />
        </div>
    );
}
