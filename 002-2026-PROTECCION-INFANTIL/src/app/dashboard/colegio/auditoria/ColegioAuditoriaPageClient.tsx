"use client";

import { AuditLogViewer } from "@/components/modules/AuditLogViewer";
import { COLEGIO_AUDIT_ACTIONS } from "@/lib/audit-actions";

export default function ColegioAuditoriaPageClient() {
    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Auditoría del colegio</h1>
                <p className="text-sm text-muted">
                    Registro de acciones de tu institución: cursos, alumnos, identificadores, cargas masivas, alertas y reportes.
                </p>
            </div>
            <AuditLogViewer
                title="Auditoría del colegio"
                subtitle="Solo se muestran las acciones registradas para tu colegio."
                defaultActions={COLEGIO_AUDIT_ACTIONS}
                endpoint="/api/colegio/auditoria"
            />
        </div>
    );
}
