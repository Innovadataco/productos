import { AppError, ERROR_CODES } from "@/lib/errors";
import type { Usuario } from "@prisma/client";

type RecursoConOperadorYTenant = { operadorId: string | null; tenantId?: string | null };
type RecursoConOperador = { operadorId: string | null };

export function esAdminRol(rol: string) {
    return rol === "ADMIN" || rol === "SCHOOL_ADMIN";
}

export function requireOperadorOAdmin(user: Usuario) {
    if (!esAdminRol(user.rol) && user.rol !== "OPERADOR") {
        throw new AppError("Permisos insuficientes", ERROR_CODES.FORBIDDEN, 403);
    }
}

export function puedeGestionarReporte(user: Usuario, reporte: RecursoConOperadorYTenant) {
    if (esAdminRol(user.rol)) {
        // SCHOOL_ADMIN solo ve recursos de su tenant (o sin tenant).
        if (user.rol === "SCHOOL_ADMIN" && reporte.tenantId && reporte.tenantId !== user.tenantId) {
            return false;
        }
        return true;
    }
    if (user.rol === "OPERADOR") {
        return reporte.operadorId === user.id;
    }
    return false;
}

export function puedeGestionarApelacion(user: Usuario, apelacion: RecursoConOperador) {
    if (esAdminRol(user.rol)) {
        return true;
    }
    if (user.rol === "OPERADOR") {
        return apelacion.operadorId === user.id;
    }
    return false;
}
