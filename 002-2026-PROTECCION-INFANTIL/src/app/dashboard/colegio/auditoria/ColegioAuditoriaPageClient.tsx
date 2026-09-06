"use client";

import { AuditLogViewer } from "@/components/modules/AuditLogViewer";
import { COLEGIO_AUDIT_ACTIONS } from "@/lib/audit-actions";

export default function ColegioAuditoriaPageClient() {
    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
            <div className="mb-2">
                <h1 className="text-2xl font-bold text-body">Auditoría del colegio</h1>
                <p className="text-sm text-muted">
                    Registro de acciones de su institución: cursos, estudiantes, identificadores, cargas masivas, alertas y reportes.
                </p>
            </div>
            {/* SPEC-569: el encabezado local de arriba es el ÚNICO — no se pasa title/subtitle al
                viewer, que si los recibe pinta su propio título y duplica «Auditoría del colegio». */}
            <AuditLogViewer
                defaultActions={COLEGIO_AUDIT_ACTIONS}
                endpoint="/api/colegio/auditoria"
                legible
            />
        </div>
    );
}
