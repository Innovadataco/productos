import type { AccionAudit } from "@prisma/client";
import { prisma } from "./prisma";
import { marcarDemo } from "./marcar";

export async function auditarDemo(
    accion: AccionAudit,
    recursoId: string | undefined,
    usuarioId: string | undefined,
    colegioId: string | undefined,
    valorNuevo?: unknown,
) {
    const data: {
        accion: AccionAudit;
        tipoRecurso: string;
        recursoId?: string;
        usuarioId?: string;
        colegioId?: string;
        valorNuevo?: string;
        ipAddress: string;
        userAgent: string;
        metadatos: { demo: boolean };
    } = {
        accion,
        tipoRecurso: "Demo",
        ipAddress: "127.0.0.1",
        userAgent: "demo-prod/002-PI-059",
        metadatos: { demo: true },
    };
    if (recursoId) data.recursoId = recursoId;
    if (usuarioId) data.usuarioId = usuarioId;
    if (colegioId) data.colegioId = colegioId;
    if (valorNuevo) data.valorNuevo = JSON.stringify(valorNuevo);

    const creado = await prisma.auditLog.create({ data });
    await marcarDemo("AuditLog", creado.id, { script: "sembrar-demo", notas: accion });
    return creado;
}
