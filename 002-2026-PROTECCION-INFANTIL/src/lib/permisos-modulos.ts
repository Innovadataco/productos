import { RolUsuario } from "@prisma/client";
import { prisma } from "./prisma";
import { verifyAuth } from "./auth";
import { AppError, ERROR_CODES } from "./errors";

/**
 * Permisos de módulos por ROL (spec 019).
 * Denegar por defecto: sin fila o activo=false → acceso denegado.
 * Jerarquía AND: un submódulo exige padre activo + submódulo activo.
 */

export async function puedeAccederAModulo(rol: string, clave: string): Promise<boolean> {
    const modulo = await prisma.moduloPermisible.findUnique({ where: { clave } });
    if (!modulo) return false;

    const propio = await prisma.permisoModulo.findUnique({
        where: { rol_moduloId: { rol, moduloId: modulo.id } },
    });
    if (propio?.activo !== true) return false;

    if (modulo.padreId) {
        const padre = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol, moduloId: modulo.padreId } },
        });
        return padre?.activo === true;
    }
    return true;
}

/**
 * Guard para API routes: autentica y exige el permiso de módulo para el rol del usuario.
 * Capa adicional a verifyAuth (no la reemplaza).
 */
export async function requireModulo(request: Request, clave: string) {
    const user = await verifyAuth();
    return assertModulo(user, clave);
}

/**
 * Variante para rutas que ya autenticaron: exige el permiso sobre el usuario actual.
 */
export async function assertModulo<T extends { rol: string }>(user: T, clave: string): Promise<T> {
    const puede = await puedeAccederAModulo(user.rol, clave);
    if (!puede) {
        throw new AppError("Sin acceso al módulo", ERROR_CODES.FORBIDDEN, 403);
    }
    return user;
}

/**
 * Roles conocidos: los del enum RolUsuario más cualquier rol que ya tenga filas
 * en PermisoModulo (así se absorben roles futuros sin refactor, pero un typo
 * en un PATCH devuelve error en lugar de crear una fila fantasma).
 */
export async function rolesConocidos(): Promise<string[]> {
    const delEnum = Object.values(RolUsuario) as string[];
    const enDatos = await prisma.permisoModulo.findMany({
        select: { rol: true },
        distinct: ["rol"],
    });
    return [...new Set([...delEnum, ...enDatos.map((r) => r.rol)])];
}

export async function obtenerRolesProtegidos(): Promise<string[]> {
    const param = await prisma.parametroSistema.findUnique({
        where: { clave: "seguridad.permisos_roles_protegidos" },
    });
    if (!param) return ["ADMIN"];
    try {
        const parsed = JSON.parse(param.valor);
        if (Array.isArray(parsed) && parsed.every((r) => typeof r === "string") && parsed.length > 0) {
            return parsed;
        }
    } catch {
        // valor no JSON; cae al default
    }
    return ["ADMIN"];
}
