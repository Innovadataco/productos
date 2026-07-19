import { AccionAudit } from "@prisma/client";

export const OPERADOR_AUDIT_ACTIONS = Object.values(AccionAudit).filter(
    (accion): accion is AccionAudit => typeof accion === "string" && accion.startsWith("OPERADOR_")
);

export const COMITE_AUDIT_ACTIONS = Object.values(AccionAudit).filter(
    (accion): accion is AccionAudit => typeof accion === "string" && accion.startsWith("COMITE_")
);

export const AUDIT_ACTION_GROUPS = [
    { key: "OPERADOR", label: "Operadores", actions: OPERADOR_AUDIT_ACTIONS },
    { key: "COMITE", label: "Comité", actions: COMITE_AUDIT_ACTIONS },
] as const;

export function labelAccionAudit(accion: AccionAudit): string {
    return accion
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
}
