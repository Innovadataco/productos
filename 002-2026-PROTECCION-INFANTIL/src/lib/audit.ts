import { prisma } from "./prisma";
import { hashConSalt } from "./anti-abuso/fuente-reporte";
import type { AccionAudit, CategoriaConducta, EstadoReporte, Prisma } from "@prisma/client";

/**
 * E-6 (ADITIVO): la IP en AuditLog deja de guardarse en claro — se persiste
 * `sha256:` + HMAC-SHA256 con ANTI_ABUSO_SALT (el mismo helper del fingerprint
 * anti-abuso: misma IP → mismo hash, correlación preservada sin reversibilidad).
 * Las filas existentes NO se reescriben (el prefijo distingue nuevas de viejas);
 * "unknown"/"worker"/"job" (no son IPs) y valores ya hasheados quedan iguales.
 */
function protegerIp(ipAddress: string): string {
    if (ipAddress === "unknown" || ipAddress === "worker" || ipAddress === "job") return ipAddress;
    if (ipAddress.startsWith("sha256:")) return ipAddress;
    return `sha256:${hashConSalt(ipAddress)}`;
}

export async function logAudit(params: {
    accion: AccionAudit;
    tipoRecurso: string;
    recursoId?: string | undefined;
    parametroId?: string | undefined;
    usuarioId?: string | undefined;
    colegioId?: string | undefined;
    valorAnterior?: string | undefined;
    valorNuevo?: string | undefined;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
    metadatos?: Record<string, unknown> | undefined;
    tx?: Prisma.TransactionClient | undefined;
}): Promise<void> {
    const db = params.tx ?? prisma;
    await db.auditLog.create({
        data: {
            accion: params.accion,
            tipoRecurso: params.tipoRecurso,
            recursoId: params.recursoId ?? null,
            parametroId: params.parametroId ?? null,
            usuarioId: params.usuarioId ?? null,
            colegioId: params.colegioId ?? null,
            valorAnterior: params.valorAnterior ?? null,
            valorNuevo: params.valorNuevo ?? null,
            ipAddress: protegerIp(params.ipAddress ?? "unknown"),
            userAgent: params.userAgent ?? "unknown",
            // undefined explícito ≡ omitir en Prisma (exactOptionalPropertyTypes)
            ...(params.metadatos ? { metadatos: params.metadatos as never } : {}),
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

/**
 * E-7 (SPEC-193 Fase 5): registra intentos de acceso a recursos administrativos
 * denegados por rol insuficiente. El usuarioId puede ser undefined si el intento
 * fue anónimo o con token inválido.
 */
export async function auditAccesoDenegado(params: {
    request?: Request;
    usuarioId?: string;
    recurso: string;
    metadatos?: Record<string, unknown>;
}): Promise<void> {
    const { ipAddress, userAgent } = extractClientInfo(params.request);
    await logAudit({
        accion: "ACCESO_DENEGADO",
        tipoRecurso: params.recurso,
        usuarioId: params.usuarioId,
        ipAddress,
        userAgent,
        metadatos: params.metadatos,
    });
}
