import { prisma } from "./prisma";
import type { AccionAudit } from "@prisma/client";

export async function logAudit(params: {
    accion: AccionAudit;
    tipoRecurso: string;
    recursoId?: string;
    usuarioId?: string;
    valorAnterior?: string;
    valorNuevo?: string;
    ipAddress?: string;
    userAgent?: string;
    metadatos?: Record<string, unknown>;
}): Promise<void> {
    await prisma.auditLog.create({
        data: {
            accion: params.accion,
            tipoRecurso: params.tipoRecurso,
            recursoId: params.recursoId ?? null,
            usuarioId: params.usuarioId ?? null,
            valorAnterior: params.valorAnterior ?? null,
            valorNuevo: params.valorNuevo ?? null,
            ipAddress: params.ipAddress ?? "unknown",
            userAgent: params.userAgent ?? "unknown",
            metadatos: params.metadatos ? (params.metadatos as never) : undefined,
        },
    });
}