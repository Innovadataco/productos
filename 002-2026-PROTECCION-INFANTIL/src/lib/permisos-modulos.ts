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

    // SPEC-509: `rol` llega como string (p. ej. del JWT); la columna es enum
    // `RolUsuario`. El cast es seguro (el rol se fija en login desde Usuario.rol,
    // que YA es RolUsuario). En lectura, un rol inexistente no matchea (Set vacío);
    // la integridad la impone la BD en la ESCRITURA.
    const propio = await prisma.permisoModulo.findUnique({
        where: { rol_moduloId: { rol: rol as RolUsuario, moduloId: modulo.id } },
    });
    if (propio?.activo !== true) return false;

    if (modulo.padreId) {
        const padre = await prisma.permisoModulo.findUnique({
            where: { rol_moduloId: { rol: rol as RolUsuario, moduloId: modulo.padreId } },
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
        prisma.permisoModulo.findMany({ where: { rol: rol as RolUsuario }, select: { moduloId: true, activo: true } }),
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
 * SPEC-384 · I-278: variante «cualquiera de estos módulos alcanza». Se usa en
 * rutas que sirven a más de un rol con módulos DISTINTOS (p. ej. la bandeja de
 * reportes-revision: el operador entra por `bandeja_reportes`, el comité por
 * `comite_bandeja`; I-274 los separó a propósito). Nunca sustituye, siempre
 * suma. Devuelve al primer módulo que autorice para cortar consultas.
 */
export async function assertAnyModulo<T extends { rol: string }>(user: T, claves: readonly string[]): Promise<T> {
    for (const clave of claves) {
        if (await puedeAccederAModulo(user.rol, clave)) return user;
    }
    throw new AppError("Sin acceso al módulo", ERROR_CODES.FORBIDDEN, 403);
}

/**
 * Roles conocidos = los del enum `RolUsuario`. SPEC-509: antes esta función
 * también sumaba los rols DISTINTOS presentes en `PermisoModulo` para «absorber
 * roles futuros sin refactor». Con `PermisoModulo.rol` ya como enum, la BD no
 * admite ningún valor fuera de `RolUsuario`: la unión con los datos era redundante
 * (todo rol vive en el enum) y se retira.
 */
export async function rolesConocidos(): Promise<string[]> {
    return Object.values(RolUsuario) as string[];
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
