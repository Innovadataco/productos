import { RolUsuario } from "@prisma/client";
import { prisma } from "./prisma";
import { verifyAuth, verifyToken } from "./auth";
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
 * Claves de módulos accesibles para un rol (activo propio AND padre activo).
 * Una sola pasada por BD: pensado para layouts/páginas server.
 */
export async function modulosPermitidosParaRol(rol: string): Promise<Set<string>> {
    const [permisos, modulos] = await Promise.all([
        prisma.permisoModulo.findMany({ where: { rol }, select: { moduloId: true, activo: true } }),
        prisma.moduloPermisible.findMany({ select: { id: true, clave: true, padreId: true } }),
    ]);
    const activoPorModulo = new Map(permisos.map((p) => [p.moduloId, p.activo]));
    const permitidos = new Set<string>();
    for (const modulo of modulos) {
        if (activoPorModulo.get(modulo.id) !== true) continue;
        if (modulo.padreId && activoPorModulo.get(modulo.padreId) !== true) continue;
        permitidos.add(modulo.clave);
    }
    return permitidos;
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

/**
 * Guard de página (server components): resuelve token → rol → permiso.
 * Uso:
 *   const acceso = await verificarAccesoPagina("bandeja_reportes");
 *   if (!acceso.permitido) return <SinAccesoModulo />;
 */
export async function verificarAccesoPagina(clave: string): Promise<{ rol: string | null; permitido: boolean }> {
    const { cookies } = await import("next/headers");
    const cookieStore = await cookies();
    const token = cookieStore.get("__Host-token")?.value ?? cookieStore.get("token")?.value;
    const payload = token ? await verifyToken(token) : null;
    const rol = (payload?.rol as string | undefined) ?? null;
    if (!rol) return { rol: null, permitido: false };
    return { rol, permitido: await puedeAccederAModulo(rol, clave) };
}
