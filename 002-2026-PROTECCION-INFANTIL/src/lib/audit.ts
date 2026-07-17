import { prisma } from "./prisma";
import type { AccionAudit, CategoriaConducta, EstadoReporte, Prisma } from "@prisma/client";

export async function logAudit(params: {
    accion: AccionAudit;
    tipoRecurso: string;
    recursoId?: string;
    parametroId?: string;
    usuarioId?: string;
    valorAnterior?: string;
    valorNuevo?: string;
    ipAddress?: string;
    userAgent?: string;
    metadatos?: Record<string, unknown>;
    tx?: Prisma.TransactionClient;
}): Promise<void> {
    const db = params.tx ?? prisma;
    await db.auditLog.create({
        data: {
            accion: params.accion,
            tipoRecurso: params.tipoRecurso,
            recursoId: params.recursoId ?? null,
            parametroId: params.parametroId ?? null,
            usuarioId: params.usuarioId ?? null,
            valorAnterior: params.valorAnterior ?? null,
            valorNuevo: params.valorNuevo ?? null,
            ipAddress: params.ipAddress ?? "unknown",
            userAgent: params.userAgent ?? "unknown",
            metadatos: params.metadatos ? (params.metadatos as never) : undefined,
        },
    });
}

function extractClientInfo(request?: Request): { ipAddress: string; userAgent: string } {
    return {
        ipAddress: request?.headers.get("x-forwarded-for") || request?.headers.get("x-real-ip") || "unknown",
        userAgent: request?.headers.get("user-agent") || "unknown",
    };
}

export async function auditCorreccion(params: {
    request?: Request;
    usuarioId: string;
    reporteId: string;
    categoriaOriginal: CategoriaConducta;
    categoriaCorregida: CategoriaConducta;
    tx?: Prisma.TransactionClient;
}): Promise<void> {
    const { ipAddress, userAgent } = extractClientInfo(params.request);
    await logAudit({
        accion: "PARAM_UPDATE",
        tipoRecurso: "ClasificacionIA",
        recursoId: params.reporteId,
        usuarioId: params.usuarioId,
        valorAnterior: JSON.stringify({ categoria: params.categoriaOriginal }),
        valorNuevo: JSON.stringify({ categoria: params.categoriaCorregida }),
        ipAddress,
        userAgent,
        tx: params.tx,
    });
}

export async function auditAnonimizacion(params: {
    request?: Request;
    usuarioId: string;
    reporteId: string;
    estadoAnterior: EstadoReporte;
    estadoNuevo: EstadoReporte;
    tx?: Prisma.TransactionClient;
}): Promise<void> {
    const { ipAddress, userAgent } = extractClientInfo(params.request);
    await logAudit({
        accion: "PARAM_UPDATE",
        tipoRecurso: "Reporte",
        recursoId: params.reporteId,
        usuarioId: params.usuarioId,
        valorAnterior: JSON.stringify({ estado: params.estadoAnterior }),
        valorNuevo: JSON.stringify({ estado: params.estadoNuevo }),
        ipAddress,
        userAgent,
        tx: params.tx,
    });
}

export async function auditAccesoAdmin(params: {
    request?: Request;
    usuarioId: string;
    accion: "LOGIN" | "LOGOUT";
}): Promise<void> {
    const { ipAddress, userAgent } = extractClientInfo(params.request);
    await logAudit({
        accion: params.accion,
        tipoRecurso: "AdminSession",
        usuarioId: params.usuarioId,
        ipAddress,
        userAgent,
    });
}
